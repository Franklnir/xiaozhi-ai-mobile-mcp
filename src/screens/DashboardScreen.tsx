import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
  Alert,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../theme/colors';
import {
  apiGetModes,
  apiGetActiveMode,
  apiSetActiveMode,
  apiGetMyCodes,
  apiGetThreads,
  apiGetMessages,
  apiGetLastDevice,
  ModeInfo,
  McpCodeInfo,
  ThreadInfo,
  MessageInfo,
} from '../api/client';

interface DashboardScreenProps {
  onLogout: () => void;
  onSettings: () => void;
}

export default function DashboardScreen({ onLogout, onSettings }: DashboardScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [modes, setModes] = useState<ModeInfo[]>([]);
  const [activeMode, setActiveMode] = useState<ModeInfo | null>(null);
  const [codes, setCodes] = useState<McpCodeInfo[]>([]);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [activeThread, setActiveThread] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState('default');
  const [loadingMode, setLoadingMode] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [modesData, codesData, lastDevice] = await Promise.all([
        apiGetModes(),
        apiGetMyCodes(),
        apiGetLastDevice(),
      ]);
      setModes(modesData);
      setCodes(codesData);

      const did = lastDevice.active_psid || 'default';
      setDeviceId(did);

      const active = await apiGetActiveMode(did);
      setActiveMode(active);

      const threadsData = await apiGetThreads(did);
      setThreads(threadsData);

      if (threadsData.length > 0 && !activeThread) {
        setActiveThread(threadsData[0].id);
        const msgs = await apiGetMessages(did, threadsData[0].id);
        setMessages(msgs.filter((m: MessageInfo) => m.role === 'user' || m.role === 'assistant'));
      }
    } catch (e: any) {
      console.warn('Load error:', e.message);
    }
  }, [activeThread]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function selectMode(modeId: number) {
    setLoadingMode(modeId);
    try {
      await apiSetActiveMode(deviceId, modeId);
      const active = await apiGetActiveMode(deviceId);
      setActiveMode(active);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoadingMode(null);
  }

  async function selectThread(threadId: number) {
    setActiveThread(threadId);
    try {
      const msgs = await apiGetMessages(deviceId, threadId);
      setMessages(msgs.filter((m: MessageInfo) => m.role === 'user' || m.role === 'assistant'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SciG Mode</Text>
          <Text style={styles.headerSubtitle}>Device: {deviceId}</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerBtn} onPress={onSettings}>
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, styles.logoutBtn]} onPress={onLogout}>
            <Text style={styles.headerBtnText}>↪️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* MCP Codes Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Koneksi MCP</Text>
          {codes.length === 0 ? (
            <Text style={styles.mutedText}>Belum ada code.</Text>
          ) : (
            codes.map((c, i) => (
              <View key={i} style={styles.codeCard}>
                <View style={styles.codeRow}>
                  <Text style={styles.codeText}>{c.code}</Text>
                  <View style={[styles.statusDot, c.is_connected ? styles.dotOnline : styles.dotOffline]} />
                </View>
                <Text style={styles.codeStatus}>
                  {c.is_connected ? '🟢 Connected' : '🔴 Disconnected'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Active Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode Aktif</Text>
          <View style={styles.activeModeCard}>
            <Text style={styles.activeModeTitle}>{activeMode?.title || '-'}</Text>
            <Text style={styles.activeModeName}>{activeMode?.name || '-'}</Text>
          </View>
        </View>

        {/* Mode Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pilih Mode</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {modes.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modeChip,
                  activeMode?.id === m.id && styles.modeChipActive,
                ]}
                onPress={() => selectMode(m.id)}
                disabled={loadingMode !== null}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    activeMode?.id === m.id && styles.modeChipTextActive,
                  ]}
                >
                  {loadingMode === m.id ? '⏳' : ''} {m.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chat Threads */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat Threads</Text>
          {threads.length === 0 ? (
            <Text style={styles.mutedText}>Belum ada thread.</Text>
          ) : (
            threads.slice(0, 10).map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.threadCard,
                  activeThread === t.id && styles.threadCardActive,
                ]}
                onPress={() => selectThread(t.id)}
              >
                <Text style={styles.threadTitle}>{t.title || 'New Chat'}</Text>
                <Text style={styles.threadMeta}>
                  #{t.id} • {t.mode_title || t.mode_name || '-'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Messages */}
        {activeThread && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chat #{activeThread}</Text>
            <View style={styles.chatArea}>
              {messages.length === 0 ? (
                <Text style={styles.mutedText}>Belum ada pesan.</Text>
              ) : (
                messages.map((m, i) => (
                  <View
                    key={i}
                    style={[
                      styles.msgRow,
                      m.role === 'user' ? styles.msgUser : styles.msgAssistant,
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        m.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAssistant,
                      ]}
                    >
                      <Text style={styles.msgLabel}>{m.role === 'user' ? 'User' : 'Xiaozhi'}</Text>
                      <Text style={styles.msgContent}>{m.content}</Text>
                      <Text style={styles.msgTime}>{m.created_at}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Bottom spacing */}
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
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.accentLight },
  headerSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  headerButtons: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: {
    width: 40, height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: { backgroundColor: 'rgba(239,68,68,0.15)' },
  headerBtnText: { fontSize: 18 },
  scroll: { flex: 1 },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  mutedText: { fontSize: FontSize.sm, color: Colors.textMuted },

  // MCP Codes
  codeCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: Colors.panelBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FontSize.sm, color: Colors.text },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotOnline: { backgroundColor: Colors.emerald },
  dotOffline: { backgroundColor: Colors.red },
  codeStatus: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },

  // Active mode
  activeModeCard: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  activeModeTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.accentLight },
  activeModeName: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },

  // Mode chips
  modeChip: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: Colors.panelBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  modeChipActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderColor: 'rgba(59,130,246,0.5)',
  },
  modeChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modeChipTextActive: { color: Colors.accentLight, fontWeight: '600' },

  // Threads
  threadCard: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: 1,
    borderColor: Colors.panelBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  threadCardActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  threadTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  threadMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },

  // Chat messages
  chatArea: {
    backgroundColor: '#eef2f7',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  msgRow: { marginVertical: 6 },
  msgUser: { alignItems: 'flex-end' },
  msgAssistant: { alignItems: 'flex-start' },
  msgBubble: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  msgBubbleUser: {
    backgroundColor: '#d7f0ff',
    borderBottomRightRadius: 4,
  },
  msgBubbleAssistant: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  msgLabel: { fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 4 },
  msgContent: { fontSize: FontSize.sm, color: '#1e293b' },
  msgTime: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 6 },
});
