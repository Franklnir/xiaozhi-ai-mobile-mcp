import React, { useState, useEffect } from 'react';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { authStore } from '../stores/authStore';

type Screen = 'login' | 'dashboard' | 'settings';

/**
 * Simple screen-based navigator without react-navigation dependency at runtime.
 * This avoids the need for native module linking during initial setup.
 * Replace with @react-navigation when doing a full native build.
 */
export default function AppNavigator() {
  const [screen, setScreen] = useState<Screen>('login');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await authStore.getToken();
      if (token) {
        setScreen('dashboard');
      }
      setCheckingAuth(false);
    })();

    const unsubscribe = authStore.subscribe((token) => {
      setScreen((current) => {
        if (!token) return 'login';
        if (current === 'login') return 'dashboard';
        return current;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (checkingAuth) {
    return null; // Could add a splash screen here
  }

  async function handleLogout() {
    await authStore.clear();
    setScreen('login');
  }

  switch (screen) {
    case 'login':
      return <LoginScreen onLoginSuccess={() => setScreen('dashboard')} />;
    case 'dashboard':
      return (
        <DashboardScreen
          onLogout={handleLogout}
          onSettings={() => setScreen('settings')}
        />
      );
    case 'settings':
      return <SettingsScreen onBack={() => setScreen('dashboard')} />;
    default:
      return <LoginScreen onLoginSuccess={() => setScreen('dashboard')} />;
  }
}
