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
  ModeInfo,
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
    })();
  }, [loadModes]);

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
    btnText: {
      color: theme.colors.white,
      fontWeight: '700',
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
