import EncryptedStorage from 'react-native-encrypted-storage';

const TOKEN_KEY = 'scig_access_token';
const SERVER_URL_KEY = 'scig_server_url';

/**
 * Secure auth store using EncryptedStorage.
 * Stores access token and server URL securely on device.
 */
export const authStore = {
  async getToken(): Promise<string | null> {
    try {
      return await EncryptedStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    await EncryptedStorage.setItem(TOKEN_KEY, token);
  },

  async removeToken(): Promise<void> {
    try {
      await EncryptedStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },

  async getServerUrl(): Promise<string> {
    try {
      const url = await EncryptedStorage.getItem(SERVER_URL_KEY);
      return url || 'http://localhost:8000';
    } catch {
      return 'http://localhost:8000';
    }
  },

  async setServerUrl(url: string): Promise<void> {
    // Normalize: remove trailing slash
    const normalized = url.replace(/\/+$/, '');
    await EncryptedStorage.setItem(SERVER_URL_KEY, normalized);
  },

  async clear(): Promise<void> {
    try {
      await EncryptedStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};
