import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Theme, useTheme } from '../theme/theme';
import {
  apiGetModes,
  apiSaveMode,
  apiRenderPrompt,
  apiGetDeviceSettings,
  apiGetLastDevice,
  apiSetActiveMode,
  apiGetMyCodes,
  apiTestMcpToken,
  apiCreateMyMcpToken,
  apiUpdateMyMcpToken,
  apiClearMyMcpToken,
  apiGetActiveMode,
  ModeInfo,
  McpCodeInfo,
} from '../api/client';
import { deviceStore } from '../stores/deviceStore';
import { registerDevice } from '../services/deviceService';
import { subscribeRealtime } from '../services/realtimeService';

const PROMPT_PREVIEW_DEBOUNCE_MS = 350;
const PROMPT_PREVIEW_INTERVAL_MS = 2 * 1000;
const DEVICE_LIVE_TEMPLATE = [
  'PERAN: Asisten monitoring perangkat yang fokus pada data HP terbaru.',
  'KONTEKS PERANGKAT (snapshot maksimal 2 detik sekali):',
  '{device_status}',
  '',
  'ATURAN:',
  "- Jika user tanya 'lokasi saya', utamakan jawab lokasi perangkat utama milik user ini.",
  '- Jika user tanya lokasi device lain yang sudah dipairkan, sebut nama alias device lalu alamat detail terbarunya.',
  '- Jika ada beberapa device, bedakan dengan jelas pakai nama alias masing-masing.',
  '- Jika user tanya lokasi, jawab pakai alamat detail terbaru, bukan koordinat mentah.',
  '- Jika user tanya status HP (baterai/jaringan), jawab pakai data terbaru.',
  '- Jika data kosong/unknown, jelaskan belum ada data terbaru.',
  '- Jawab singkat, jelas, dan bisa dibacakan.',
].join('\n');

function normalizeModeIntroduction(mode: Pick<ModeInfo, 'name' | 'introduction'>) {
  if ((mode.name || '') !== 'device_live') {
    return mode.introduction || '';
  }
  const intro = mode.introduction || '';
  if (!intro.trim() || /snapshot maksimal 5 detik|update 30 detik|real-time/i.test(intro)) {
    return DEVICE_LIVE_TEMPLATE;
  }
  return intro.replace(/snapshot maksimal 5 detik sekali/gi, 'snapshot maksimal 2 detik sekali');
}

export default function ModeEditorScreen() {
  const { theme } = useTheme();
  const isFocused = useIsFocused();
  const [modes, setModes] = useState<ModeInfo[]>([]);
  const [selectedMode, setSelectedMode] = useState<ModeInfo | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [preview, setPreview] = useState('');
  const [source, setSource] = useState('Indonesia');
  const [target, setTarget] = useState('Arab');
  const [deviceId, setDeviceId] = useState('');
  const [activePsid, setActivePsid] = useState('default');
  const [activeModeId, setActiveModeId] = useState<number | null>(null);
  const [mcpCodes, setMcpCodes] = useState<McpCodeInfo[]>([]);
  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenTest, setTokenTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({
    status: 'idle',
  });
  const [previewLoading, setPreviewLoading] = useState(false);

  const enterAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const selectMode = useCallback((mode: ModeInfo) => {
    setSelectedMode(mode);
    setName(mode.name);
    setTitle(mode.title);
    setIntro(normalizeModeIntroduction(mode));
  }, []);

  const loadModes = useCallback(async (preferredModeId?: number | null) => {
    const list = await apiGetModes();
    setModes(list);

    const keepId = selectedMode?.id || preferredModeId || null;
    const nextMode = list.find((item) => item.id === keepId) || list[0] || null;
    if (nextMode) {
      selectMode(nextMode);
    } else {
      setSelectedMode(null);
      setName('');
      setTitle('');
      setIntro('');
    }
    return list;
  }, [selectMode, selectedMode?.id]);

  const loadCodes = useCallback(async () => {
    try {
      const list = await apiGetMyCodes();
      setMcpCodes(list || []);
      setActiveCodeId((current) => {
        if (current && (list || []).some((item) => item.id === current)) {
          return current;
        }
        return list?.[0]?.id || null;
      });
    } catch {
      setMcpCodes([]);
      setActiveCodeId(null);
    }
  }, []);

  const loadActiveState = useCallback(async () => {
    const last = await apiGetLastDevice();
    const psid = last.active_psid || 'default';
    const activeMode = await apiGetActiveMode(psid);
    setActivePsid(psid);
    setActiveModeId(activeMode?.id || null);
    return { psid, activeModeId: activeMode?.id || null };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const deviceSettings = await apiGetDeviceSettings('default');
        if (!active) return;
        setSource(deviceSettings.source || 'Indonesia');
        setTarget(deviceSettings.target || 'Arab');
      } catch {
        // ignore device settings bootstrap failures
      }

      try {
        let did = await deviceStore.getDeviceId();
        if (!did) {
          const reg = await registerDevice();
          did = reg.device_id;
        }
        if (!active) return;
        setDeviceId(did);

        const [state] = await Promise.all([loadActiveState(), loadCodes()]);
        if (!active) return;
        await loadModes(state.activeModeId);
      } catch (e: any) {
        if (active) {
          Alert.alert('Error', e?.message || 'Gagal memuat mode editor');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadActiveState, loadCodes, loadModes]);

  useEffect(() => {
    setTokenInput('');
    setTokenTest({ status: 'idle' });
  }, [activeCodeId]);

  const updatePreview = useCallback(async () => {
    if (!selectedMode) {
      setPreview('');
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await apiRenderPrompt(
        selectedMode.id || null,
        { source, target },
        deviceId || undefined,
        {
          title,
          introduction: intro,
        },
      );
      setPreview(res.prompt || '');
    } catch (e: any) {
      setPreview(`Error: ${e?.message || 'Gagal merender prompt.'}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [deviceId, intro, selectedMode, source, target, title]);

  useEffect(() => {
    if (!selectedMode) {
      return;
    }

    const timer = setTimeout(() => {
      updatePreview().catch(() => {});
    }, PROMPT_PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [selectedMode, title, intro, source, target, deviceId, updatePreview]);

  useEffect(() => {
    if (!isFocused || selectedMode?.name !== 'device_live') {
      return;
    }

    updatePreview().catch(() => {});
    const timer = setInterval(() => {
      updatePreview().catch(() => {});
    }, PROMPT_PREVIEW_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isFocused, selectedMode?.id, selectedMode?.name, updatePreview]);

  useEffect(() => {
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === 'ws_open') {
        loadActiveState().catch(() => {});
        loadCodes().catch(() => {});
        if (selectedMode?.name === 'device_live') {
          updatePreview().catch(() => {});
        }
        return;
      }

      if (event.type === 'active_mode_changed') {
        if (!event.device_id || event.device_id === activePsid) {
          loadActiveState().catch(() => {});
        }
        return;
      }

      if (event.type === 'mcp_status_updated' || event.type === 'mcp_codes_updated') {
        loadCodes().catch(() => {});
        return;
      }

      if (event.type === 'device_status_updated' && selectedMode?.name === 'device_live') {
        if (!event.device_id || event.device_id === deviceId) {
          updatePreview().catch(() => {});
        }
      }
    });

    return unsubscribe;
  }, [activePsid, deviceId, loadActiveState, loadCodes, selectedMode?.name, updatePreview]);

  const activeCode = mcpCodes.find((c) => c.id === activeCodeId) || null;
  const activeCodeDisplay = activeCode?.code_display || activeCode?.code || 'MCP aktif';
  const hasSavedToken = !!activeCode?.has_token;
  const canSaveToken = tokenTest.status === 'ok' && !!tokenInput.trim() && !hasSavedToken;
  const tokenStatusTone: 'neutral' | 'success' | 'danger' | 'warning' =
    tokenTest.status === 'ok'
      ? 'success'
      : tokenTest.status === 'error'
      ? 'danger'
      : hasSavedToken
      ? 'warning'
      : 'neutral';
  const tokenStatusText =
    tokenTest.status === 'testing'
      ? 'Sedang cek koneksi token...'
      : tokenTest.status === 'ok'
      ? 'Token terkoneksi dan siap disimpan.'
      : tokenTest.status === 'error'
      ? `Token gagal konek: ${tokenTest.message || 'Periksa URL / token MCP.'}`
      : hasSavedToken
      ? `Token aktif untuk ${activeCodeDisplay} sudah tersimpan. Hapus token dulu kalau ingin mengganti.`
      : 'Belum dites.';
  const isApplied = !!selectedMode?.id && selectedMode.id === activeModeId;

  async function testToken() {
    if (!tokenInput.trim()) {
      Alert.alert('Token kosong', 'Masukkan token/WS URL terlebih dulu.');
      return;
    }
    setTokenTest({ status: 'testing' });
    try {
      const res = await apiTestMcpToken(tokenInput.trim());
      if (res.ok) {
        setTokenTest({ status: 'ok', message: 'Connected' });
      } else {
        setTokenTest({ status: 'error', message: res.error || 'Gagal konek' });
      }
    } catch (e: any) {
      setTokenTest({ status: 'error', message: e?.message || 'Gagal konek' });
    }
  }

  async function saveToken() {
    if (tokenTest.status !== 'ok') {
      Alert.alert('Test dulu', 'Silakan test koneksi sebelum simpan.');
      return;
    }
    try {
      if (activeCodeId) {
        const updated = await apiUpdateMyMcpToken(activeCodeId, tokenInput.trim());
        Alert.alert('Tersimpan', `Token untuk ${updated.code_display || updated.code || 'MCP aktif'} berhasil diperbarui.`);
      } else {
        const created = await apiCreateMyMcpToken(tokenInput.trim());
        Alert.alert('Tersimpan', `Code baru dibuat: ${created.code_display || created.code || 'MCP aktif'}`);
      }
      setTokenInput('');
      setTokenTest({ status: 'idle' });
      loadCodes().catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal simpan token');
    }
  }

  async function clearToken() {
    if (!activeCodeId) {
      Alert.alert('Tidak ada code', 'Belum ada code untuk dihapus.');
      return;
    }
    try {
      await apiClearMyMcpToken(activeCodeId);
      Alert.alert('OK', `Token ${activeCodeDisplay} dihapus.`);
      setTokenInput('');
      setTokenTest({ status: 'idle' });
      loadCodes().catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal hapus token');
    }
  }

  async function saveMode() {
    try {
      await apiSaveMode({ id: selectedMode?.id || 0, name, title, introduction: intro });
      await loadModes(selectedMode?.id || null);
      Alert.alert('Tersimpan', 'Mode berhasil disimpan.');
      await updatePreview();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal simpan mode');
    }
  }

  async function applyActiveMode() {
    try {
      if (!selectedMode) return;
      const last = await apiGetLastDevice();
      const psid = last.active_psid || 'default';
      await apiSetActiveMode(psid, selectedMode.id);
      setActivePsid(psid);
      setActiveModeId(selectedMode.id);
      Alert.alert('Mode Aktif', `Mode ${selectedMode.title} sekarang aktif untuk ${psid}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal apply mode');
    }
  }

  const animStyle = {
    opacity: enterAnim,
    transform: [
      {
        translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <Animated.View style={animStyle}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mode Editor</Text>
            <Text style={styles.headerSubtitle}>Edit prompt dan lihat rendered system prompt live setiap 2 detik.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Token MCP (User)</Text>
            <Text style={styles.cardSubtitle}>
              Cek koneksi dulu sebelum simpan. Status online/offline akan ikut berubah realtime dengan web backend.
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {mcpCodes.length === 0 ? (
                <Text style={styles.mutedText}>Belum ada code. Simpan token untuk membuat code baru.</Text>
              ) : (
                mcpCodes.map((c) => {
                  const active = c.id === activeCodeId;
                  const connected = !!c.is_connected;
                  const label = c.code_display || c.code || 'MCP aktif';
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.codeChip, active && styles.codeChipActive]}
                      onPress={() => setActiveCodeId(c.id)}
                    >
                      <Text style={[styles.codeChipText, active && styles.codeChipTextActive]}>
                        {label}
                      </Text>
                      <Text style={[styles.codeChipSub, connected ? styles.statusTextSuccess : styles.statusTextDanger]}>
                        {connected ? 'Connected' : 'Offline'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {activeCode ? (
              <View style={styles.inlineMetaRow}>
                <View style={[styles.statePill, activeCode.is_connected ? styles.statePillSuccess : styles.statePillDanger]}>
                  <Text style={styles.statePillText}>
                    {activeCode.is_connected ? 'Hijau: token aktif terhubung' : 'Merah: token belum terhubung'}
                  </Text>
                </View>
                <Text style={styles.mutedText}>
                  {activeCode.last_err_at ? `Error terakhir: ${activeCode.last_err_at}` : 'Token disembunyikan demi keamanan.'}
                </Text>
              </View>
            ) : null}

            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={tokenInput}
              onChangeText={(v) => {
                setTokenInput(v);
                setTokenTest({ status: 'idle' });
              }}
              placeholder="wss://api.xiaozhi.me/mcp/?token=..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View
              style={[
                styles.statusRow,
                tokenStatusTone === 'success'
                  ? styles.statusRowSuccess
                  : tokenStatusTone === 'danger'
                  ? styles.statusRowDanger
                  : tokenStatusTone === 'warning'
                  ? styles.statusRowWarning
                  : undefined,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  tokenStatusTone === 'success'
                    ? styles.statusDotSuccess
                    : tokenStatusTone === 'danger'
                    ? styles.statusDotDanger
                    : tokenStatusTone === 'warning'
                    ? styles.statusDotWarning
                    : undefined,
                ]}
              />
              <Text style={styles.statusLabel}>{tokenStatusText}</Text>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={testToken}>
                <Text style={styles.secondaryBtnText}>Cek Koneksi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, !canSaveToken && styles.disabledBtn]}
                onPress={saveToken}
                disabled={!canSaveToken}
              >
                <Text style={styles.btnText}>Simpan Token</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={clearToken}>
                <Text style={styles.btnText}>Hapus Token</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pilih Mode</Text>
            <Text style={styles.cardSubtitle}>Tombol apply akan berubah hijau saat mode yang dipilih memang sedang aktif di backend.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {modes.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeChip, selectedMode?.id === m.id && styles.modeChipActive]}
                  onPress={() => selectMode(m)}
                >
                  <Text style={[styles.modeChipText, selectedMode?.id === m.id && styles.modeChipTextActive]}>
                    {m.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.card}>
            <View style={styles.applyInfoRow}>
              <View>
                <Text style={styles.cardTitle}>Nama & Judul</Text>
                <Text style={styles.cardSubtitle}>PSID aktif backend: {activePsid}</Text>
              </View>
              <View style={[styles.applyPill, isApplied ? styles.applyPillActive : styles.applyPillIdle]}>
                <Text style={styles.applyPillText}>{isApplied ? 'Sedang Dipakai' : 'Belum Di-apply'}</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="mode_name"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Judul mode"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.introHeaderRow}>
              <Text style={[styles.cardTitle, { marginTop: 12, marginBottom: 0 }]}>Introduction</Text>
              {selectedMode?.name === 'device_live' ? (
                <TouchableOpacity style={styles.templateBtn} onPress={() => setIntro(DEVICE_LIVE_TEMPLATE)}>
                  <Text style={styles.templateBtnText}>Template 2 Detik</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={intro}
              onChangeText={setIntro}
              multiline
              numberOfLines={6}
              placeholder="Isi prompt peran / aturan"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.applyBtn, isApplied ? styles.applyBtnActive : styles.applyBtnIdle]}
                onPress={applyActiveMode}
              >
                <Text style={styles.btnText}>{isApplied ? 'Mode Sedang Aktif' : 'Apply Mode'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveMode}>
                <Text style={styles.btnText}>Simpan</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewWrap}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>Rendered System Prompt (Live)</Text>
                <Text style={styles.previewHint}>
                  {previewLoading
                    ? 'Memuat...'
                    : selectedMode?.name === 'device_live'
                    ? 'Mode device_live ikut refresh otomatis tiap 2 detik sesuai data perangkat terbaru.'
                    : 'Preview mengikuti perubahan edit secara langsung.'}
                </Text>
              </View>
              <Text style={styles.preview}>{preview || '-'}</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xxl + 16,
      paddingBottom: theme.spacing.lg,
    },
    headerTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: '800',
      color: theme.colors.accentLight,
      fontFamily: theme.fonts.heading,
    },
    headerSubtitle: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textMuted,
      marginTop: 4,
      fontFamily: theme.fonts.body,
    },
    card: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      ...theme.effects.cardShadow,
    },
    cardTitle: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
      marginBottom: 8,
    },
    cardSubtitle: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginBottom: 10,
      fontFamily: theme.fonts.body,
    },
    chipScroll: {
      marginBottom: theme.spacing.sm,
    },
    mutedText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
      marginTop: 6,
    },
    inlineMetaRow: {
      marginTop: theme.spacing.xs,
      gap: theme.spacing.sm,
    },
    statePill: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      borderWidth: theme.isNeo ? 2 : 1,
    },
    statePillSuccess: {
      backgroundColor: theme.isNeo ? '#dcfce7' : 'rgba(16,185,129,0.12)',
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(16,185,129,0.3)',
    },
    statePillDanger: {
      backgroundColor: theme.isNeo ? '#fee2e2' : 'rgba(239,68,68,0.12)',
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(239,68,68,0.3)',
    },
    statePillText: {
      fontSize: 10,
      color: theme.colors.text,
      fontWeight: '700',
      fontFamily: theme.fonts.body,
    },
    codeChip: {
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginRight: theme.spacing.sm,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      alignItems: 'center',
    },
    codeChipActive: {
      backgroundColor: theme.colors.accentLight,
      borderColor: theme.colors.black,
    },
    codeChipText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.body,
    },
    codeChipTextActive: {
      color: theme.colors.black,
      fontWeight: '700',
      fontFamily: theme.fonts.heading,
    },
    codeChipSub: {
      fontSize: 10,
      marginTop: 2,
      fontFamily: theme.fonts.body,
    },
    statusTextSuccess: { color: theme.colors.emeraldDark },
    statusTextDanger: { color: theme.colors.redDark },
    input: {
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      fontFamily: theme.fonts.body,
    },
    textArea: {
      minHeight: 140,
      textAlignVertical: 'top',
    },
    btnRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    applyBtn: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      borderWidth: theme.isNeo ? 2 : 1,
    },
    applyBtnIdle: {
      backgroundColor: theme.colors.surfaceLight,
      borderColor: theme.colors.panelBorder,
    },
    applyBtnActive: {
      backgroundColor: theme.isNeo ? '#86efac' : '#16a34a',
      borderColor: theme.isNeo ? theme.colors.black : '#15803d',
    },
    disabledBtn: {
      opacity: 0.45,
    },
    secondaryBtn: {
      flex: 1,
      backgroundColor: theme.colors.surfaceLight,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    dangerBtn: {
      flex: 1,
      backgroundColor: theme.colors.red,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.isNeo ? theme.colors.black : theme.colors.redDark,
    },
    btnText: {
      color: theme.colors.white,
      fontWeight: '700',
      fontFamily: theme.fonts.body,
    },
    secondaryBtnText: {
      color: theme.colors.text,
      fontWeight: '700',
      fontFamily: theme.fonts.body,
    },
    statusRow: {
      marginTop: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceLight,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    statusRowSuccess: {
      backgroundColor: theme.isNeo ? '#dcfce7' : 'rgba(16,185,129,0.1)',
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(16,185,129,0.25)',
    },
    statusRowDanger: {
      backgroundColor: theme.isNeo ? '#fee2e2' : 'rgba(239,68,68,0.1)',
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(239,68,68,0.25)',
    },
    statusRowWarning: {
      backgroundColor: theme.isNeo ? '#fef3c7' : 'rgba(245,158,11,0.1)',
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(245,158,11,0.25)',
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.textMuted,
    },
    statusDotSuccess: { backgroundColor: theme.colors.emerald },
    statusDotDanger: { backgroundColor: theme.colors.red },
    statusDotWarning: { backgroundColor: '#f59e0b' },
    statusLabel: {
      flex: 1,
      color: theme.colors.text,
      fontSize: theme.fontSize.xs,
      fontFamily: theme.fonts.body,
    },
    modeChip: {
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginRight: theme.spacing.sm,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    modeChipActive: {
      backgroundColor: theme.colors.accentLight,
      borderColor: theme.isNeo ? theme.colors.black : theme.colors.accent,
    },
    modeChipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.body,
    },
    modeChipTextActive: {
      color: theme.colors.black,
      fontWeight: '700',
      fontFamily: theme.fonts.heading,
    },
    applyInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    applyPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      borderWidth: theme.isNeo ? 2 : 1,
    },
    applyPillActive: {
      backgroundColor: theme.isNeo ? '#dcfce7' : 'rgba(16,185,129,0.12)',
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(16,185,129,0.3)',
    },
    applyPillIdle: {
      backgroundColor: theme.isNeo ? '#fef3c7' : 'rgba(245,158,11,0.12)',
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(245,158,11,0.3)',
    },
    applyPillText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
      fontFamily: theme.fonts.body,
    },
    introHeaderRow: {
      marginTop: theme.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    templateBtn: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 8,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceLight,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    templateBtnText: {
      color: theme.colors.text,
      fontSize: theme.fontSize.xs,
      fontWeight: '700',
      fontFamily: theme.fonts.body,
    },
    previewWrap: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceLight,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    previewHeader: {
      marginBottom: theme.spacing.sm,
    },
    previewTitle: {
      color: theme.colors.text,
      fontSize: theme.fontSize.sm,
      fontWeight: '700',
      fontFamily: theme.fonts.heading,
    },
    previewHint: {
      marginTop: 4,
      color: theme.colors.textMuted,
      fontSize: theme.fontSize.xs,
      fontFamily: theme.fonts.body,
    },
    preview: {
      color: theme.colors.text,
      fontSize: theme.fontSize.xs,
      lineHeight: 20,
      fontFamily: theme.fonts.mono,
    },
  });
