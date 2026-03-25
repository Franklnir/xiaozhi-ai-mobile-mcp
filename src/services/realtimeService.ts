import { authStore } from '../stores/authStore';

export interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

type RealtimeListener = (event: RealtimeEvent) => void;

const listeners = new Set<RealtimeListener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let shouldReconnect = false;
let connectingPromise: Promise<void> | null = null;

function emit(event: RealtimeEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore listener failures
    }
  });
}

function toWebSocketUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  const wsBase = normalized.replace(/^http/i, (scheme) => (scheme.toLowerCase() === 'https' ? 'wss' : 'ws'));
  return `${wsBase}/ws`;
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function createSocket() {
  const serverUrl = await authStore.getServerUrl();
  const token = await authStore.getToken();
  const url = token
    ? `${toWebSocketUrl(serverUrl)}?access_token=${encodeURIComponent(token)}`
    : toWebSocketUrl(serverUrl);

  socket = new WebSocket(url);

  socket.onopen = () => {
    reconnectAttempt = 0;
    emit({ type: 'ws_open' });
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data || '{}'));
      if (payload && payload.type) {
        emit(payload);
      }
    } catch {
      // ignore malformed realtime payloads
    }
  };

  socket.onerror = () => {
    emit({ type: 'ws_error' });
  };

  socket.onclose = () => {
    socket = null;
    emit({ type: 'ws_close' });
    if (!shouldReconnect) {
      return;
    }
    clearReconnectTimer();
    const delay = Math.min(10000, 1200 + reconnectAttempt * 800);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectRealtime().catch(() => {});
    }, delay);
  };
}

export async function connectRealtime() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  shouldReconnect = true;
  clearReconnectTimer();
  connectingPromise = createSocket().finally(() => {
    connectingPromise = null;
  });
  return connectingPromise;
}

export function disconnectRealtime() {
  shouldReconnect = false;
  reconnectAttempt = 0;
  clearReconnectTimer();
  if (socket) {
    try {
      socket.close();
    } catch {
      // ignore close failures
    }
  }
  socket = null;
}

export function subscribeRealtime(listener: RealtimeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
