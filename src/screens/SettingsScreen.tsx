import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../theme/colors';
import { authStore } from '../stores/authStore';
import { apiGetDeviceSettings, apiSetDeviceSettings, apiGetConfig } from '../api/client';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [source, setSource] = useState('Indonesia');
  const [target, setTarget] = useState('Arab');
  const [languages, setLanguages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
      } catch (e) {
        console.warn('Settings load error:', e);
      }
    })();
  }, []);

  async function saveServerUrl() {
    await authStore.setServerUrl(serverUrl.trim());
    Alert.alert('Tersimpan', 'Server URL berhasil disimpan. Restart app untuk efek penuh.');
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Server URL */}
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
            placeholder="http://192.168.1.100:8000"
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={saveServerUrl}>
            <Text style={styles.saveBtnText}>Simpan URL</Text>
          </TouchableOpacity>
        </View>

        {/* Language */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bahasa Terjemahan</Text>
          <Text style={styles.cardSubtitle}>
            Atur bahasa sumber dan target untuk mode terjemahan
          </Text>

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

        {/* Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasi</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App</Text>
            <Text style={styles.infoValue}>SciG Mode MCP Mobile v1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Backend</Text>
            <Text style={styles.infoValue}>{serverUrl}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>React Native</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.xxl + 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.panelBorder,
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  backBtn: { padding: Spacing.sm },
  backBtnText: { color: Colors.accentLight, fontSize: FontSize.sm, fontWeight: '600' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  card: {
    backgroundColor: Colors.panel,
    borderWidth: 1,
    borderColor: Colors.panelBorder,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cardSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  input: {
    backgroundColor: 'rgba(2,6,23,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  saveBtnGreen: { backgroundColor: Colors.emeraldDark },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  chipScroll: { flexDirection: 'row', marginBottom: Spacing.sm },
  langChip: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: Colors.panelBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  langChipActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: 'rgba(16,185,129,0.5)',
  },
  langChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  langChipTextActive: { color: Colors.emerald, fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.panelBorder,
  },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, color: Colors.text },
});
