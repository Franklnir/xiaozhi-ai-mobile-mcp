import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Theme, useTheme } from '../theme/theme';
import { apiGetLastDevice, apiGetThreads, apiGetMessages, ThreadInfo, MessageInfo } from '../api/client';
import { subscribeRealtime } from '../services/realtimeService';

export default function MessagesScreen() {
  const { theme } = useTheme();
  const [deviceId, setDeviceId] = useState('default');
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [activeThread, setActiveThread] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const loadMessagesForThread = useCallback(async (psid: string, threadId: number | null) => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    const msgs = await apiGetMessages(psid, threadId);
    setMessages((msgs || []).filter((m) => m.role === 'user' || m.role === 'assistant'));
  }, []);

  const loadThreadsAndMessages = useCallback(async (preferredThreadId?: number | null) => {
    const last = await apiGetLastDevice();
    const psid = last.active_psid || 'default';
    setDeviceId(psid);
    const data = await apiGetThreads(psid);
    setThreads(data || []);

    const nextThreadId = preferredThreadId
      ?? (activeThread && data.some((thread) => thread.id === activeThread) ? activeThread : null)
      ?? data[0]?.id
      ?? null;

    setActiveThread(nextThreadId);
    await loadMessagesForThread(psid, nextThreadId);
  }, [activeThread, loadMessagesForThread]);

  useEffect(() => {
    loadThreadsAndMessages().catch(() => {});
  }, [loadThreadsAndMessages]);

  useEffect(() => {
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === 'ws_open' || event.type === 'route_changed' || event.type === 'chat_created' || event.type === 'chat_deleted') {
        loadThreadsAndMessages().catch(() => {});
        return;
      }
      if (event.type === 'chat_message_sent') {
        if (!event.device_id || event.device_id === deviceId) {
          loadThreadsAndMessages(event.thread_id || activeThread).catch(() => {});
        }
      }
    });
    return unsubscribe;
  }, [activeThread, deviceId, loadThreadsAndMessages]);

  async function onRefresh() {
    setRefreshing(true);
    await loadThreadsAndMessages();
    setRefreshing(false);
  }

  async function selectThread(threadId: number) {
    setActiveThread(threadId);
    await loadMessagesForThread(deviceId, threadId);
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
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
      >
        <Animated.View style={animStyle}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>PSID: {deviceId}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Threads</Text>
            {threads.length === 0 ? (
              <Text style={styles.muted}>Belum ada thread.</Text>
            ) : (
              threads.slice(0, 30).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.threadItem, activeThread === t.id && styles.threadItemActive]}
                  onPress={() => selectThread(t.id)}
                >
                  <Text style={styles.threadTitle}>{t.title || 'New Chat'}</Text>
                  <Text style={styles.threadMeta}>#{t.id} • {t.mode_title || t.mode_name || '-'}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Messages</Text>
            {messages.length === 0 ? (
              <Text style={styles.muted}>Belum ada pesan.</Text>
            ) : (
              messages.map((m) => (
                <View key={m.id} style={[styles.msgBubble, m.role === 'user' ? styles.msgUser : styles.msgAssistant]}>
                  <Text style={styles.msgRole}>{m.role === 'user' ? 'User' : 'Xiaozhi'}</Text>
                  <Text style={styles.msgContent}>{m.content}</Text>
                  <Text style={styles.msgTime}>{m.created_at}</Text>
                </View>
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
      marginBottom: theme.spacing.sm,
    },
    muted: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
    },
    threadItem: {
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    threadItemActive: {
      borderColor: theme.colors.accentLight,
    },
    threadTitle: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
      fontFamily: theme.fonts.heading,
    },
    threadMeta: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
      marginTop: 4,
      fontFamily: theme.fonts.body,
    },
    msgBubble: {
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    msgUser: {
      backgroundColor: theme.isNeo ? '#bbf7d0' : '#d7f0ff',
    },
    msgAssistant: {
      backgroundColor: theme.isNeo ? theme.colors.panel : theme.colors.white,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
    },
    msgRole: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.body,
      marginBottom: 4,
    },
    msgContent: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
      fontFamily: theme.fonts.body,
    },
    msgTime: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
      marginTop: 6,
      textAlign: 'right',
      fontFamily: theme.fonts.mono,
    },
  });
