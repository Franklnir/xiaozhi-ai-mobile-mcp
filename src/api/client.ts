import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { authStore } from '../stores/authStore';

let apiClient: AxiosInstance | null = null;

/**
 * Initialize or re-initialize the API client with the given server URL.
 */
export async function initApiClient(): Promise<AxiosInstance> {
  const baseURL = await authStore.getServerUrl();

  apiClient = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  // Request interceptor: attach token
  apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await authStore.getToken();
      if (token && config.headers) {
        config.headers.Cookie = `access_token=${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor: handle 401
  apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await authStore.removeToken();
      }
      return Promise.reject(error);
    },
  );

  return apiClient;
}

/**
 * Get the current API client instance. Initializes if needed.
 */
export async function getApi(): Promise<AxiosInstance> {
  if (!apiClient) {
    return initApiClient();
  }
  return apiClient;
}

// ─── API Functions ───────────────────────────────────────

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface RegisterResult {
  success: boolean;
  token?: string;
  error?: string;
}

function extractRegisterError(html?: string): string | null {
  if (!html) return null;
  const match = html.match(/<div class="mt-5[^>]*>([^<]+)<\/div>/i);
  return match?.[1]?.trim() || null;
}

/**
 * Login to the backend. The backend uses cookie-based auth,
 * so we POST form data and extract the cookie from the redirect response.
 */
export async function apiLogin(
  serverUrl: string,
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    // Save server URL for future API calls
    await authStore.setServerUrl(serverUrl);

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post(`${serverUrl}/login`, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      withCredentials: true,
    });

    // Extract access_token from Set-Cookie header
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      for (const cookie of cookies) {
        const match = cookie.match(/access_token=([^;]+)/);
        if (match) {
          const token = match[1];
          await authStore.setToken(token);
          await initApiClient();
          return { success: true, token };
        }
      }
    }

    return { success: false, error: 'Token tidak ditemukan di response' };
  } catch (error: any) {
    const msg = error.response?.data?.error || error.message || 'Login gagal';
    return { success: false, error: msg };
  }
}

/**
 * Register a new account. Backend returns HTML; on success it sets cookie + redirect.
 */
export async function apiRegister(
  serverUrl: string,
  username: string,
  password: string,
  confirmPassword: string,
  code: string,
): Promise<RegisterResult> {
  try {
    await authStore.setServerUrl(serverUrl);

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('confirm_password', confirmPassword);
    formData.append('code', code);

    const response = await axios.post(`${serverUrl}/register`, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      withCredentials: true,
    });

    const cookies = response.headers['set-cookie'];
    if (cookies) {
      for (const cookie of cookies) {
        const match = cookie.match(/access_token=([^;]+)/);
        if (match) {
          const token = match[1];
          await authStore.setToken(token);
          await initApiClient();
          return { success: true, token };
        }
      }
    }

    const html = typeof response.data === 'string' ? response.data : '';
    return { success: false, error: extractRegisterError(html) || 'Register gagal' };
  } catch (error: any) {
    const msg = error.response?.data?.error || error.message || 'Register gagal';
    return { success: false, error: msg };
  }
}

export interface ModeInfo {
  id: number;
  name: string;
  title: string;
  introduction: string;
}

export interface McpCodeInfo {
  code: string;
  is_connected: boolean;
  last_error?: string;
}

export interface ThreadInfo {
  id: number;
  title: string;
  updated_at: string;
  mode_name?: string;
  mode_title?: string;
}

export interface MessageInfo {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export async function apiGetConfig() {
  const api = await getApi();
  const res = await api.get('/api/config');
  return res.data;
}

export async function apiGetModes(): Promise<ModeInfo[]> {
  const api = await getApi();
  const res = await api.get('/api/modes');
  return res.data;
}

export async function apiGetActiveMode(deviceId: string): Promise<ModeInfo> {
  const api = await getApi();
  const res = await api.get(`/api/mode?device_id=${encodeURIComponent(deviceId)}`);
  return res.data;
}

export async function apiSetActiveMode(deviceId: string, modeId: number) {
  const api = await getApi();
  const res = await api.post('/api/mode', { device_id: deviceId, mode_id: modeId });
  return res.data;
}

export async function apiGetMyCodes(): Promise<McpCodeInfo[]> {
  const api = await getApi();
  const res = await api.get('/api/mcp/my-codes');
  return res.data;
}

export async function apiGetThreads(deviceId: string): Promise<ThreadInfo[]> {
  const api = await getApi();
  const res = await api.get(`/api/chats?device_id=${encodeURIComponent(deviceId)}`);
  return res.data;
}

export async function apiGetMessages(
  deviceId: string,
  threadId: number,
  limit = 200,
): Promise<MessageInfo[]> {
  const api = await getApi();
  const res = await api.get(
    `/api/chats/${threadId}/messages?device_id=${encodeURIComponent(deviceId)}&limit=${limit}`,
  );
  return res.data;
}

export async function apiGetLastDevice() {
  const api = await getApi();
  const res = await api.get('/api/last-device');
  return res.data;
}

export async function apiGetDeviceSettings(deviceId: string) {
  const api = await getApi();
  const res = await api.get(`/api/device/settings?device_id=${encodeURIComponent(deviceId)}`);
  return res.data;
}

export async function apiSetDeviceSettings(deviceId: string, source: string, target: string) {
  const api = await getApi();
  const res = await api.post('/api/device/settings', { device_id: deviceId, source, target });
  return res.data;
}
