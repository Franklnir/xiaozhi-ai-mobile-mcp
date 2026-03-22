import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Theme, useTheme } from '../theme/theme';
import { apiGetDeviceDetail, apiSetDeviceAlias, DeviceInfo } from '../api/client';

export default function DeviceDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const deviceId = route.params?.deviceId as string;
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [alias, setAlias] = useState('');

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    (async () => {
      try {
        const detail = await apiGetDeviceDetail(deviceId);
        setDevice(detail);
        setAlias(detail.alias || detail.device_name || '');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Gagal memuat device');
      }
    })();
  }, [deviceId]);

  async function saveAlias() {
    if (!alias.trim()) {
      Alert.alert('Error', 'Nama tidak boleh kosong');
      return;
    }
    await apiSetDeviceAlias(deviceId, alias.trim());
    Alert.alert('OK', 'Nama device disimpan');
  }

  const addr = device?.address_full || [device?.address_street, device?.address_area, device?.address_city].filter(Boolean).join(', ');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Detail Device</Text>
        <Text style={styles.subtitle}>{deviceId}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nama Device</Text>
          <TextInput
            style={styles.input}
            value={alias}
            onChangeText={setAlias}
            placeholder="Nama lokasi"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={saveAlias}>
            <Text style={styles.btnText}>Simpan Nama</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alamat</Text>
          <Text style={styles.value}>{addr || '-'}</Text>
          <Text style={styles.meta}>Lat/Lon: {device?.latitude || '-'} / {device?.longitude || '-'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <Text style={styles.value}>Baterai: {device?.battery_level || '-'}%</Text>
          <Text style={styles.meta}>Charging: {device?.charging_type || '-'}</Text>
          <Text style={styles.meta}>Jaringan: {device?.network_type || '-'} / {device?.carrier || '-'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: theme.spacing.lg },
    title: { fontSize: theme.fontSize.xl, fontWeight: '800', color: theme.colors.accentLight, fontFamily: theme.fonts.heading },
    subtitle: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 4, fontFamily: theme.fonts.mono },
    card: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      ...theme.effects.cardShadow,
    },
    cardTitle: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginBottom: 8, fontFamily: theme.fonts.body },
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
    primaryBtn: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    btnText: { color: theme.colors.white, fontWeight: '700' },
    value: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontFamily: theme.fonts.body },
    meta: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 4, fontFamily: theme.fonts.body },
  });
