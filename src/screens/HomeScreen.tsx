import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Theme, useTheme } from '../theme/theme';
import { apiGetActiveMode, apiGetLastDevice, apiGetMyCodes, LastDeviceInfo, McpCodeInfo, ModeInfo } from '../api/client';
import { subscribeRealtime } from '../services/realtimeService';

function formatDateTime(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('id-ID');
  } catch {
    return value;
  }
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activeMode, setActiveMode] = useState<ModeInfo | null>(null);
  const [codes, setCodes] = useState<McpCodeInfo[]>([]);
  const [lastDevice, setLastDevice] = useState<LastDeviceInfo | null>(null);

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

  const load = useCallback(async () => {
    try {
      const last = await apiGetLastDevice();
      const deviceId = last.active_psid || 'default';
      setLastDevice(last);
      const [mode, codesData] = await Promise.all([
        apiGetActiveMode(deviceId),
        apiGetMyCodes(),
      ]);
      setActiveMode(mode);
      setCodes(codesData || []);
    } catch {
      // ignore temporary dashboard refresh errors
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeRealtime((event) => {
      if ([
        'active_mode_changed',
        'mcp_status_updated',
        'mcp_codes_updated',
        'route_changed',
        'chat_message_sent',
        'ws_open',
      ].includes(event.type)) {
        load().catch(() => {});
      }
    });
    return unsubscribe;
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const animStyle = {
    opacity: enterAnim,
    transform: [
      {
        translateY: enterAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const activePsid = lastDevice?.active_psid || 'default';
  const xiaozhiOnline = !!lastDevice?.xiaozhi_online;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
      >
        <Animated.View style={animStyle}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>SciG Mode</Text>
            <Text style={styles.headerSubtitle}>Home Dashboard Realtime</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mode Aktif</Text>
            <Text style={styles.cardValue}>{activeMode?.title || '-'}</Text>
            <Text style={styles.cardMeta}>{activeMode?.name || '-'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status Xiaozhi AI</Text>
            <View style={styles.statusRow}>
              <Text style={styles.cardValue}>{xiaozhiOnline ? 'Aktif' : 'Belum Aktif'}</Text>
              <Text style={[styles.statusBadge, xiaozhiOnline ? styles.online : styles.offline]}>
                {xiaozhiOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
            <Text style={styles.cardMeta}>PSID aktif: {activePsid}</Text>
            <Text style={styles.cardMeta}>Perangkat fisik terakhir: {lastDevice?.last_physical_device_id || '-'}</Text>
            <Text style={styles.cardMeta}>Terakhir aktif: {formatDateTime(lastDevice?.xiaozhi_last_seen_at)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Koneksi MCP</Text>
            {codes.length === 0 ? (
              <Text style={styles.muted}>Belum ada code.</Text>
            ) : (
              codes.map((c) => (
                <View key={c.id} style={styles.codeRow}>
                  <Text style={styles.codeText}>{c.code_display || c.code || 'MCP aktif'}</Text>
                  <Text style={[styles.codeStatus, c.is_connected ? styles.online : styles.offline]}>
                    {c.is_connected ? 'Online' : 'Offline'}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sinkronisasi</Text>
            <Text style={styles.cardMeta}>Websocket aktif untuk mode, messages, MCP, dan pair device.</Text>
            <Text style={styles.cardMeta}>Heartbeat perangkat berjalan realtime setiap 2 detik saat APK aktif.</Text>
          </View>

          <View style={{ height: 32 }} />
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
      fontSize: theme.fontSize.xxl,
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
    },
    cardValue: {
      fontSize: theme.fontSize.lg,
      color: theme.colors.text,
      marginTop: 6,
      fontWeight: '700',
      fontFamily: theme.fonts.heading,
    },
    cardMeta: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 6,
      fontFamily: theme.fonts.body,
    },
    muted: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textMuted,
      marginTop: 8,
      fontFamily: theme.fonts.body,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    statusBadge: {
      marginTop: 10,
      fontSize: theme.fontSize.xs,
      fontWeight: '700',
      fontFamily: theme.fonts.body,
    },
    codeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      gap: theme.spacing.sm,
    },
    codeText: {
      flex: 1,
      fontSize: theme.fontSize.sm,
      fontFamily: theme.fonts.mono,
      color: theme.colors.text,
    },
    codeStatus: {
      fontSize: theme.fontSize.xs,
      fontWeight: '600',
      fontFamily: theme.fonts.body,
    },
    online: { color: theme.colors.emerald },
    offline: { color: theme.colors.red },
  });
