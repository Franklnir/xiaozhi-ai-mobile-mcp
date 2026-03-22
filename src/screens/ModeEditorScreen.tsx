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
  ModeInfo,
  McpCodeInfo,
} from '../api/client';
import { deviceStore } from '../stores/deviceStore';
import { registerDevice } from '../services/deviceService';

export default function ModeEditorScreen() {
  const { theme } = useTheme();
  const [modes, setModes] = useState<ModeInfo[]>([]);
  const [selectedMode, setSelectedMode] = useState<ModeInfo | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [preview, setPreview] = useState('');
  const [source, setSource] = useState('Indonesia');
  const [target, setTarget] = useState('Arab');
  const [deviceId, setDeviceId] = useState('');
  const [mcpCodes, setMcpCodes] = useState<McpCodeInfo[]>([]);
  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenTest, setTokenTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({
    status: 'idle',
  });

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

  const loadModes = useCallback(async () => {
    const list = await apiGetModes();
    setModes(list);
    if (list.length > 0 && !selectedMode) {
      selectMode(list[0]);
    }
  }, [selectedMode]);

  const loadCodes = useCallback(async () => {
    try {
      const list = await apiGetMyCodes();
      setMcpCodes(list || []);
      if (!activeCodeId && list && list.length) {
        setActiveCodeId(list[0].id);
      }
    } catch {
      setMcpCodes([]);
    }
  }, [activeCodeId]);

  useEffect(() => {
    (async () => {
      try {
        const deviceSettings = await apiGetDeviceSettings('default');
        setSource(deviceSettings.source || 'Indonesia');
        setTarget(deviceSettings.target || 'Arab');
      } catch {
        // ignore
      }
      let did = await deviceStore.getDeviceId();
      if (!did) {
        const reg = await registerDevice();
        did = reg.device_id;
      }
      setDeviceId(did);
      loadModes().catch(() => {});
      loadCodes().catch(() => {});
    })();
  }, [loadModes, loadCodes]);

  useEffect(() => {
    const timer = setInterval(() => {
      updatePreview().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [name, title, intro, source, target, deviceId]);

  function selectMode(mode: ModeInfo) {
    setSelectedMode(mode);
    setName(mode.name);
    setTitle(mode.title);
    setIntro(mode.introduction);
    setTimeout(() => {
      updatePreview().catch(() => {});
    }, 200);
  }

  async function updatePreview() {
    const res = await apiRenderPrompt(selectedMode?.id || null, { source, target }, deviceId || undefined);
    setPreview(res.prompt || '');
  }

  const activeCode = mcpCodes.find((c) => c.id === activeCodeId) || null;

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
      setTokenTest({ status: 'error', message: e.message || 'Gagal konek' });
    }
  }

  async function saveToken() {
    if (tokenTest.status !== 'ok') {
      Alert.alert('Test dulu', 'Silakan test koneksi sebelum simpan.');
      return;
    }
    try {
      if (activeCodeId) {
        await apiUpdateMyMcpToken(activeCodeId, tokenInput.trim());
        Alert.alert('Tersimpan', 'Token berhasil diperbarui.');
      } else {
        const created = await apiCreateMyMcpToken(tokenInput.trim());
        Alert.alert('Tersimpan', `Code baru dibuat: ${created.code}`);
      }
      setTokenInput('');
      setTokenTest({ status: 'idle' });
      loadCodes().catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal simpan token');
    }
  }

  async function clearToken() {
    if (!activeCodeId) {
      Alert.alert('Tidak ada code', 'Belum ada code untuk dihapus.');
      return;
    }
    try {
      await apiClearMyMcpToken(activeCodeId);
      Alert.alert('OK', 'Token dihapus.');
      setTokenTest({ status: 'idle' });
      loadCodes().catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal hapus token');
    }
  }

  async function saveMode() {
    try {
      await apiSaveMode({ id: selectedMode?.id || 0, name, title, introduction: intro });
      await loadModes();
      Alert.alert('Tersimpan', 'Mode berhasil disimpan.');
      await updatePreview();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal simpan mode');
    }
  }

  async function applyActiveMode() {
    try {
      const last = await apiGetLastDevice();
      const psid = last.active_psid || 'default';
      if (!selectedMode) return;
      await apiSetActiveMode(psid, selectedMode.id);
      Alert.alert('OK', `Mode aktif diset untuk ${psid}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal apply mode');
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
            <Text style={styles.headerSubtitle}>Edit prompt & preview real-time</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Token MCP (User)</Text>
            <Text style={styles.cardSubtitle}>Satu token hanya untuk satu akun. Test koneksi dulu sebelum simpan.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {mcpCodes.length === 0 ? (
                <Text style={styles.mutedText}>Belum ada code. Simpan token untuk membuat code baru.</Text>
              ) : (
                mcpCodes.map((c) => {
                  const active = c.id === activeCodeId;
                  const connected = !!c.is_connected;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.codeChip, active && styles.codeChipActive]}
                      onPress={() => setActiveCodeId(c.id)}
                    >
                      <Text style={[styles.codeChipText, active && styles.codeChipTextActive]}>
                        {c.code}
                      </Text>
                      <Text style={styles.codeChipSub}>
                        {connected ? 'Connected' : 'Offline'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {activeCode ? (
              <Text style={styles.mutedText}>
                Status: {activeCode.is_connected ? 'Connected' : 'Not connected'}
                {activeCode.last_err_at ? ` • last_err ${activeCode.last_err_at}` : ''}
              </Text>
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

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>
                {tokenTest.status === 'testing'
                  ? 'Testing...'
                  : tokenTest.status === 'ok'
                  ? 'Connected'
                  : tokenTest.status === 'error'
                  ? `Error: ${tokenTest.message || ''}`
                  : 'Belum dites'}
              </Text>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={testToken}>
                <Text style={styles.btnText}>Test Connect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveToken}>
                <Text style={styles.btnText}>Simpan Token</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={clearToken}>
                <Text style={styles.btnText}>Hapus Token</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pilih Mode</Text>
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
            <Text style={styles.cardTitle}>Nama & Judul</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="mode_name" placeholderTextColor={theme.colors.textMuted} />
            <TextInput style={[styles.input, { marginTop: 10 }]} value={title} onChangeText={setTitle} placeholder="Judul mode" placeholderTextColor={theme.colors.textMuted} />
            <Text style={[styles.cardTitle, { marginTop: 12 }]}>Introduction</Text>
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
              <TouchableOpacity style={styles.secondaryBtn} onPress={applyActiveMode}>
                <Text style={styles.btnText}>Apply Mode</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveMode}>
                <Text style={styles.btnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rendered System Prompt (Live)</Text>
            <Text style={styles.preview}>{preview || '-'}</Text>
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
      color: theme.colors.textMuted,
      marginTop: 2,
    },
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
    statusRow: {
      marginTop: theme.spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceLight,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    statusLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.body,
    },
    preview: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.text,
      fontFamily: theme.fonts.mono,
      marginTop: theme.spacing.sm,
    },
    modeChip: {
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      marginRight: theme.spacing.sm,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    modeChipActive: {
      backgroundColor: theme.colors.accentLight,
      borderColor: theme.colors.black,
    },
    modeChipText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.body,
    },
    modeChipTextActive: {
      color: theme.colors.black,
      fontWeight: '700',
      fontFamily: theme.fonts.heading,
    },
  });
