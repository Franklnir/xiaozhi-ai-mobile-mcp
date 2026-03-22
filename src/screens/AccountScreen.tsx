import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import { Theme, ThemeName, useTheme } from '../theme/theme';
import { authStore } from '../stores/authStore';
import { deviceStore } from '../stores/deviceStore';
import { apiGetDeviceSettings, apiSetDeviceSettings, apiGetConfig, apiGetPublicSettings, SocialLink } from '../api/client';
import { SERVER_URL_PLACEHOLDER } from '../utils/serverUrl';

export default function AccountScreen() {
  const { theme, themeName, setThemeName } = useTheme();
  const [serverUrl, setServerUrl] = useState('');
  const [source, setSource] = useState('Indonesia');
  const [target, setTarget] = useState('Arab');
  const [languages, setLanguages] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [saving, setSaving] = useState(false);

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

  const contentAnimStyle = {
    opacity: enterAnim,
    transform: [
      {
        translateY: enterAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  const themeOptions: { key: ThemeName; label: string }[] = [
    { key: 'default', label: 'Default (Sistem)' },
    { key: 'dark', label: 'Gelap' },
    { key: 'light', label: 'Terang' },
    { key: 'neo', label: 'Neo Brutalism' },
  ];

  useEffect(() => {
    (async () => {
      const url = await authStore.getServerUrl();
      setServerUrl(url);
      try {
        const config = await apiGetConfig();
        setLanguages(config.languages || []);
        const settings = await apiGetDeviceSettings('default');
        setSource(settings.source || 'Indonesia');
        setTarget(settings.target || 'Arab');
        if (url) {
          const pub = await apiGetPublicSettings(url);
          setSocialLinks(pub.social_links || []);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  async function saveServerUrl() {
    try {
      await authStore.setServerUrl(serverUrl.trim());
      Alert.alert('Tersimpan', 'Server URL berhasil disimpan.');
    } catch (e: any) {
      Alert.alert('URL tidak valid', e.message || 'Server URL tidak valid.');
    }
  }

  async function saveLanguage() {
    setSaving(true);
    try {
      await apiSetDeviceSettings('default', source, target);
      Alert.alert('Tersimpan', 'Bahasa berhasil disimpan.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSaving(false);
  }

  async function handleLogout() {
    await authStore.clear();
    await deviceStore.clear();
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={contentAnimStyle}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Akun & Pengaturan</Text>
            <Text style={styles.headerSubtitle}>Sinkron dengan backend & web</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Server URL</Text>
            <Text style={styles.cardSubtitle}>Alamat backend SciG Mode MCP</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={SERVER_URL_PLACEHOLDER}
              placeholderTextColor={theme.colors.textMuted}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveServerUrl}>
              <Text style={styles.saveBtnText}>Simpan URL</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tema Tampilan</Text>
            <Text style={styles.cardSubtitle}>Pilih mode gelap, terang, default, atau neo brutalism</Text>

            <View style={styles.themeRow}>
              {themeOptions.map((opt) => {
                const active = themeName === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.themeChip, active && styles.themeChipActive]}
                    onPress={() => setThemeName(opt.key)}
                  >
                    <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bahasa Terjemahan</Text>
            <Text style={styles.cardSubtitle}>Atur bahasa sumber dan target</Text>

            <Text style={styles.label}>Bahasa Sumber</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langChip, source === lang && styles.langChipActive]}
                  onPress={() => setSource(lang)}
                >
                  <Text style={[styles.langChipText, source === lang && styles.langChipTextActive]}>
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Bahasa Target</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langChip, target === lang && styles.langChipActive]}
                  onPress={() => setTarget(lang)}
                >
                  <Text style={[styles.langChipText, target === lang && styles.langChipTextActive]}>
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, styles.saveBtnGreen]}
              onPress={saveLanguage}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Menyimpan...' : 'Simpan Bahasa'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Media Sosial</Text>
            <Text style={styles.cardSubtitle}>Link resmi dari admin</Text>
            {socialLinks.length === 0 ? (
              <Text style={styles.emptyText}>Belum ada link.</Text>
            ) : (
              socialLinks.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.label}-${idx}`}
                  style={styles.socialBtn}
                  onPress={() => Linking.openURL(item.url)}
                >
                  <Text style={styles.socialLabel}>{item.label}</Text>
                  <Text style={styles.socialUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Akun</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
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
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xxl + 16,
      paddingBottom: theme.spacing.lg,
    },
    headerTitle: {
      fontSize: theme.fontSize.lg,
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
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: theme.fonts.heading,
    },
    cardSubtitle: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
      marginTop: 4,
      fontFamily: theme.fonts.body,
    },
    input: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      fontFamily: theme.fonts.body,
    },
    saveBtn: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    saveBtnGreen: { backgroundColor: theme.colors.emerald },
    saveBtnText: {
      color: theme.colors.white,
      fontWeight: '700',
      fontFamily: theme.fonts.body,
    },
    themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
    themeChip: {
      backgroundColor: theme.colors.surfaceLight,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.full,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    themeChipActive: { backgroundColor: theme.colors.accentLight, borderColor: theme.colors.black },
    themeChipText: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontFamily: theme.fonts.body },
    themeChipTextActive: { color: theme.colors.black, fontWeight: '700', fontFamily: theme.fonts.heading },
    label: { marginTop: theme.spacing.md, fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
    chipScroll: { marginTop: theme.spacing.sm },
    langChip: {
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginRight: theme.spacing.sm,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    langChipActive: { backgroundColor: theme.colors.accentLight, borderColor: theme.colors.black },
    langChipText: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontFamily: theme.fonts.body },
    langChipTextActive: { color: theme.colors.black, fontWeight: '700', fontFamily: theme.fonts.heading },
    logoutBtn: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.red,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    logoutText: { color: theme.colors.white, fontWeight: '700' },
    emptyText: {
      marginTop: theme.spacing.sm,
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
    },
    socialBtn: {
      marginTop: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    socialLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: theme.fonts.heading,
    },
    socialUrl: {
      marginTop: 4,
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.body,
    },
  });
