import React from 'react';
import { StatusBar } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/theme';

function AppShell() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.bg}
      />
      <AppNavigator />
    </>
  );
}

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
