import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Easing,
} from 'react-native';
import { Theme, useTheme } from '../theme/theme';
import {
  bootstrapTrackingAfterLogin,
  getTrackingPermissionSummary,
  openAppSettings,
  stopTracking,
  TrackingPermissionSummary,
} from '../services/deviceService';
import { authStore } from '../stores/authStore';
import { deviceStore } from '../stores/deviceStore';

interface PermissionGateScreenProps {
  onReady?: () => void;
}

function buildHint(summary: TrackingPermissionSummary | null): string {
  if (!summary || summary.ready) {
    return '';
  }
  const tail = summary.needsSettings
    ? ' Di Android terbaru, beberapa izin perlu diaktifkan manual dari Pengaturan Aplikasi > Izin.'
    : '';
  return `Aplikasi butuh izin ini agar tracking 10 detik, lokasi real-time, dan foreground service tetap jalan: ${summary.missing.join(', ')}.${tail}`;
}

export default function PermissionGateScreen({ onReady }: PermissionGateScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const enterAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const setupInFlightRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TrackingPermissionSummary | null>(null);
  const [message, setMessage] = useState('Menyiapkan izin lokasi, notifikasi, dan sinkronisasi perangkat...');

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  const runSetup = useCallback(async (interactive = true) => {
    if (setupInFlightRef.current) {
      return;
    }
    setupInFlightRef.current = true;
    setLoading(true);
    setMessage(
      interactive
        ? 'Meminta izin lokasi, background, dan notifikasi dengan aman...'
        : 'Memeriksa ulang status izin perangkat...',
    );
    try {
      const result = interactive
        ? await bootstrapTrackingAfterLogin()
        : await getTrackingPermissionSummary();
      if (!mountedRef.current) return;
      setSummary(result);
      if (result.ready) {
        if (!interactive) {
          await deviceStore.setTrackingEnabled(true);
        }
        setMessage('Izin lengkap. Menyiapkan aplikasi...');
        onReady?.();
        return;
      }
      setMessage(buildHint(result));
    } catch (e: any) {
      if (!mountedRef.current) return;
      setSummary(null);
      setMessage(e?.message || 'Gagal menyiapkan tracking. Coba lagi atau buka pengaturan aplikasi.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      setupInFlightRef.current = false;
    }
  }, [onReady]);

  useEffect(() => {
    mountedRef.current = true;
    runSetup(true).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runSetup(false).catch(() => {});
      }
    });
    return () => {
      mountedRef.current = false;
      sub.remove();
    };
  }, [runSetup]);

  const animStyle = {
    opacity: enterAnim,
    transform: [
      {
        translateY: enterAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  async function handleLogout() {
    await stopTracking().catch(() => {});
    await authStore.clear();
    await deviceStore.clear();
  }

  const blocked = !loading && !!summary && !summary.ready;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, animStyle]}>
        <Text style={styles.title}>Aktifkan Izin Perangkat</Text>
        <Text style={styles.subtitle}>
          Setelah login, aplikasi akan meminta izin secara bertahap supaya lebih aman. Jika Android tidak menampilkan dialog lanjutan, lanjutkan dari tombol pengaturan aplikasi.
        </Text>

        <View style={styles.statusBox}>
          {loading ? <ActivityIndicator size="small" color={theme.colors.accent} /> : null}
          <Text style={styles.statusText}>{message}</Text>
        </View>

        {blocked ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Izin Belum Lengkap</Text>
            <Text style={styles.warningText}>{buildHint(summary)}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => runSetup(true).catch(() => {})}
        >
          <Text style={styles.primaryText}>
            {loading ? 'Memproses...' : summary?.needsSettings ? 'Saya Sudah Aktifkan' : 'Coba Lagi'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => openAppSettings().catch(() => {})}>
          <Text style={styles.secondaryText}>Buka Pengaturan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={handleLogout}>
          <Text style={styles.ghostText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      padding: theme.spacing.xl,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.isNeo ? 3 : 1,
      borderColor: theme.colors.panelBorder,
      ...theme.effects.cardShadow,
    },
    title: {
      fontSize: theme.fontSize.xl,
      color: theme.colors.text,
      fontWeight: '800',
      fontFamily: theme.fonts.heading,
    },
    subtitle: {
      marginTop: theme.spacing.sm,
      fontSize: theme.fontSize.sm,
      color: theme.colors.textMuted,
      lineHeight: 20,
      fontFamily: theme.fonts.body,
    },
    statusBox: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceLight,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      gap: theme.spacing.sm,
    },
    statusText: {
      color: theme.colors.text,
      fontSize: theme.fontSize.sm,
      lineHeight: 20,
      fontFamily: theme.fonts.body,
    },
    warningBox: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.isNeo ? '#fff7ed' : 'rgba(245, 158, 11, 0.12)',
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.isNeo ? theme.colors.black : 'rgba(245, 158, 11, 0.35)',
    },
    warningTitle: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: theme.fontSize.sm,
      fontFamily: theme.fonts.heading,
    },
    warningText: {
      marginTop: 6,
      color: theme.colors.textSecondary,
      fontSize: theme.fontSize.sm,
      lineHeight: 20,
      fontFamily: theme.fonts.body,
    },
    primaryBtn: {
      marginTop: theme.spacing.lg,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      borderWidth: theme.isNeo ? 2 : 0,
      borderColor: theme.colors.black,
    },
    btnDisabled: {
      opacity: 0.7,
    },
    primaryText: {
      color: theme.colors.white,
      fontWeight: '800',
      fontSize: theme.fontSize.sm,
      fontFamily: theme.fonts.heading,
    },
    secondaryBtn: {
      marginTop: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    secondaryText: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: theme.fontSize.sm,
      fontFamily: theme.fonts.body,
    },
    ghostBtn: {
      marginTop: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.sm,
    },
    ghostText: {
      color: theme.colors.textMuted,
      fontSize: theme.fontSize.sm,
      fontFamily: theme.fonts.body,
    },
  });
