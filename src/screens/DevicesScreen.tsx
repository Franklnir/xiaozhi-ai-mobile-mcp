import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import QRCode from 'react-native-qrcode-svg';
import { Theme, useTheme } from '../theme/theme';
import {
  apiClaimPairToken,
  apiCreatePairToken,
  apiGetDevices,
  DeviceInfo,
} from '../api/client';
import { deviceStore } from '../stores/deviceStore';
import { registerDevice, sendHeartbeat, startTracking, stopTracking } from '../services/deviceService';

export default function DevicesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [deviceId, setDeviceId] = useState('');
  const [deviceToken, setDeviceToken] = useState('');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [pairToken, setPairToken] = useState('');
  const [pairExpires, setPairExpires] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [manualAlias, setManualAlias] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [bootError, setBootError] = useState('');

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

  const loadDevices = useCallback(async () => {
    try {
      const list = await apiGetDevices();
      setDevices(list || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setBootError('');
        const reg = await registerDevice();
        if (!active) return;
        setDeviceId(reg.device_id);
        setDeviceToken(reg.device_token);
        const enabled = await deviceStore.isTrackingEnabled();
        if (!active) return;
        setTrackingEnabled(enabled);
        if (enabled) {
          try {
            await startTracking();
          } catch (e: any) {
            if (active) {
              setBootError(e?.message || 'Tracking belum aktif penuh. Lengkapi izin aplikasi.');
            }
          }
        }
        await loadDevices();
      } catch (e: any) {
        if (active) {
          setBootError(e?.message || 'Gagal menyiapkan perangkat.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadDevices]);

  useEffect(() => {
    if (isFocused) loadDevices();
  }, [isFocused, loadDevices]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadDevices().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [loadDevices]);

  async function toggleTracking() {
    try {
      if (trackingEnabled) {
        await stopTracking();
        setTrackingEnabled(false);
      } else {
        await startTracking();
        setTrackingEnabled(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal mengubah tracking');
    }
  }

  async function generatePairToken() {
    try {
      const res = await apiCreatePairToken(deviceId, deviceToken);
      setPairToken(res.pair_token || '');
      setPairExpires(res.expires_at || '');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal membuat QR');
    }
  }

  async function claimToken() {
    if (!manualToken.trim()) {
      Alert.alert('Error', 'Pair token wajib diisi');
      return;
    }
    try {
      await apiClaimPairToken(manualToken.trim(), manualAlias.trim() || undefined);
      setManualToken('');
      setManualAlias('');
      await loadDevices();
      Alert.alert('OK', 'Device berhasil ditambahkan');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal menambah device');
    }
  }

  async function manualHeartbeat() {
    try {
      await sendHeartbeat();
      await loadDevices();
      Alert.alert('OK', 'Data perangkat diperbarui');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal update data');
    }
  }

  const mapHtml = useMemo(() => {
    const markers = devices
      .filter((d) => d.latitude && d.longitude)
      .map((d) => ({
        name: d.alias || d.device_name || d.device_id,
        lat: d.latitude,
        lon: d.longitude,
        addr: d.address_full || [d.address_street, d.address_area, d.address_city].filter(Boolean).join(', '),
      }));

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            html, body, #map { height: 100%; margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            const devices = ${JSON.stringify(markers)};
            const map = L.map('map').setView([0,0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            if (devices.length) {
              const group = [];
              devices.forEach(d => {
                const m = L.marker([d.lat, d.lon]).addTo(map).bindPopup('<b>' + d.name + '</b><br>' + (d.addr || '-'));
                group.push(m);
              });
              const bounds = L.featureGroup(group).getBounds();
              map.fitBounds(bounds.pad(0.2));
            }
          </script>
        </body>
      </html>
    `;
  }, [devices]);

  const myDevice = devices.find((d) => d.device_id === deviceId);

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
            <Text style={styles.headerTitle}>Perangkat Saya</Text>
            <Text style={styles.headerSubtitle}>Update tiap 10 detik</Text>
          </View>

          {bootError ? (
            <View style={styles.warnCard}>
              <Text style={styles.warnTitle}>Perlu Perhatian</Text>
              <Text style={styles.warnText}>{bootError}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Perangkat Utama</Text>
            <Text style={styles.cardValue}>{deviceId || '-'}</Text>
            <Text style={styles.cardMeta}>{myDevice?.address_full || 'Alamat belum tersedia'}</Text>
            <Text style={styles.cardMeta}>
              Baterai: {myDevice?.battery_level ?? '-'}% • {myDevice?.battery_status || '-'}
            </Text>
            <Text style={styles.cardMeta}>
              Jaringan: {myDevice?.network_type || '-'} / {myDevice?.carrier || '-'}
            </Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={toggleTracking}>
                <Text style={styles.btnText}>{trackingEnabled ? 'Stop Tracking' : 'Start Tracking'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={manualHeartbeat}>
                <Text style={styles.btnText}>Sync Now</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Generate QR</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, !deviceToken && styles.disabledBtn]}
              onPress={generatePairToken}
              disabled={!deviceToken}
            >
              <Text style={styles.btnText}>Buat QR Pair</Text>
            </TouchableOpacity>
            {pairToken ? (
              <View style={styles.qrBox}>
                <QRCode value={pairToken} size={160} />
                <Text style={styles.qrText}>{pairToken}</Text>
                <Text style={styles.qrMeta}>Expired: {pairExpires}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tambah Device</Text>
            <TextInput
              style={styles.input}
              value={manualToken}
              onChangeText={setManualToken}
              placeholder="Pair token"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={manualAlias}
              onChangeText={setManualAlias}
              placeholder="Nama lokasi (opsional)"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('QrScanner' as never)}
              >
                <Text style={styles.btnText}>Scan QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={claimToken}>
                <Text style={styles.btnText}>Tambah</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Peta Lokasi</Text>
            <View style={styles.mapBox}>
              <WebView originWhitelist={['*']} source={{ html: mapHtml }} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Daftar Device</Text>
            {devices.length === 0 ? (
              <Text style={styles.muted}>Belum ada device.</Text>
            ) : (
              devices.map((d) => (
                <TouchableOpacity
                  key={d.device_id}
                  style={styles.deviceRow}
                  onPress={() => navigation.navigate('DeviceDetail' as never, { deviceId: d.device_id } as never)}
                >
                  <View>
                    <Text style={styles.deviceName}>{d.alias || d.device_name || d.device_id}</Text>
                    <Text style={styles.deviceMeta}>{d.address_full || '-'}</Text>
                  </View>
                  <Text style={[styles.deviceStatus, d.is_online ? styles.online : styles.offline]}>
                    {d.is_online ? 'Online' : 'Offline'}
                  </Text>
                </TouchableOpacity>
              ))
            )}
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
    warnCard: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.isNeo ? '#fff7ed' : 'rgba(245, 158, 11, 0.12)',
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(245, 158, 11, 0.35)',
      ...theme.effects.cardShadow,
    },
    warnTitle: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: theme.fontSize.sm,
      fontFamily: theme.fonts.heading,
    },
    warnText: {
      marginTop: 6,
      color: theme.colors.textSecondary,
      fontSize: theme.fontSize.sm,
      lineHeight: 20,
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
    cardValue: {
      fontSize: theme.fontSize.md,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: theme.fonts.heading,
    },
    cardMeta: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: theme.fonts.body,
    },
    btnRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    disabledBtn: {
      opacity: 0.6,
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
    btnText: { color: theme.colors.white, fontWeight: '700', fontFamily: theme.fonts.body },
    qrBox: { alignItems: 'center', marginTop: theme.spacing.md },
    qrText: { marginTop: theme.spacing.sm, color: theme.colors.text, fontFamily: theme.fonts.mono, fontSize: 12 },
    qrMeta: { marginTop: 4, color: theme.colors.textMuted, fontSize: 11 },
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
    mapBox: { height: 240, borderRadius: theme.radius.lg, overflow: 'hidden' },
    muted: { color: theme.colors.textMuted, fontFamily: theme.fonts.body },
    deviceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.panelBorder,
    },
    deviceName: { fontSize: theme.fontSize.sm, color: theme.colors.text, fontFamily: theme.fonts.heading },
    deviceMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, fontFamily: theme.fonts.body },
    deviceStatus: { fontSize: theme.fontSize.xs, fontWeight: '700' },
    online: { color: theme.colors.emerald },
    offline: { color: theme.colors.red },
  });
