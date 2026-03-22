import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Theme, useTheme } from '../theme/theme';
import { apiLogin, apiRegister } from '../api/client';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { theme } = useTheme();
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:8000');
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const logoAnimStyle = {
    opacity: enterAnim,
    transform: [
      {
        translateY: enterAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 0],
        }),
      },
    ],
  };

  const cardAnimStyle = {
    opacity: enterAnim,
    transform: [
      {
        translateY: enterAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  function switchMode(nextIsRegister: boolean) {
    setIsRegister(nextIsRegister);
    setError('');
  }

  async function handleLogin() {
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      setError('Semua field wajib diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiLogin(serverUrl.trim(), username.trim(), password);
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.error || 'Login gagal');
      }
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (
      !serverUrl.trim() ||
      !username.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !registerCode.trim()
    ) {
      setError('Semua field wajib diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiRegister(
        serverUrl.trim(),
        username.trim(),
        password,
        confirmPassword,
        registerCode.trim(),
      );
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.error || 'Register gagal');
      }
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo area */}
        <Animated.View style={[styles.logoArea, logoAnimStyle]}>
          <Text style={styles.logoIcon}>🤖</Text>
          <Text style={styles.logoTitle}>SciG Mode</Text>
          <Text style={styles.logoSubtitle}>Xiaozhi AI Controller</Text>
        </Animated.View>

        {/* Login card */}
        <Animated.View style={[styles.card, cardAnimStyle]}>
          <Text style={styles.cardTitle}>{isRegister ? 'Register' : 'Login'}</Text>
          <Text style={styles.cardSubtitle}>
            {isRegister ? 'Buat akun baru SciG Mode MCP' : 'Masuk dengan akun SciG Mode MCP Anda'}
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.100:8000"
            placeholderTextColor={theme.colors.textMuted}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="username"
            placeholderTextColor={theme.colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {isRegister ? (
            <>
              <Text style={styles.label}>Konfirmasi Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••"
                  placeholderTextColor={theme.colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeText}>{showConfirmPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Kode Register</Text>
              <TextInput
                style={styles.input}
                placeholder="10 karakter"
                placeholderTextColor={theme.colors.textMuted}
                value={registerCode}
                onChangeText={setRegisterCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={isRegister ? handleRegister : handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.buttonText}>{isRegister ? 'Daftar' : 'Masuk'}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
            <Text
              style={styles.hintLink}
              onPress={() => switchMode(!isRegister)}
            >
              {isRegister ? 'Masuk di sini' : 'Daftar di sini'}
            </Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    logoArea: {
      alignItems: 'center',
      marginBottom: theme.spacing.xxl,
    },
    logoIcon: {
      fontSize: 56,
      marginBottom: theme.spacing.sm,
    },
    logoTitle: {
      fontSize: theme.fontSize.xxl,
      fontWeight: '800',
      color: theme.colors.accentLight,
      fontFamily: theme.fonts.heading,
    },
    logoSubtitle: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      fontFamily: theme.fonts.body,
    },
    card: {
      backgroundColor: theme.colors.panel,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      borderRadius: theme.radius.xl,
      padding: theme.spacing.xl,
      ...theme.effects.cardShadow,
    },
    cardTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
      fontFamily: theme.fonts.heading,
    },
    cardSubtitle: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
      fontFamily: theme.fonts.body,
    },
    errorBox: {
      backgroundColor: theme.isNeo ? '#fee2e2' : 'rgba(239,68,68,0.1)',
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.isNeo ? theme.colors.redDark : 'rgba(239,68,68,0.3)',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    errorText: {
      color: theme.isNeo ? theme.colors.redDark : '#fca5a5',
      fontSize: theme.fontSize.sm,
      fontFamily: theme.fonts.body,
    },
    label: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.md,
      fontFamily: theme.fonts.body,
    },
    input: {
      backgroundColor: theme.isNeo ? '#fff7ed' : theme.colors.surface,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      color: theme.colors.text,
      fontSize: theme.fontSize.md,
      fontFamily: theme.fonts.body,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isNeo ? '#fff7ed' : theme.colors.surface,
      borderWidth: theme.isNeo ? 2 : 1,
      borderColor: theme.colors.panelBorder,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      color: theme.colors.text,
      fontSize: theme.fontSize.md,
      fontFamily: theme.fonts.body,
    },
    eyeButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    eyeText: {
      color: theme.colors.textSecondary,
      fontSize: theme.fontSize.md,
    },
    button: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.xl,
      borderWidth: theme.isNeo ? 2 : 0,
      borderColor: theme.isNeo ? theme.colors.black : 'transparent',
      ...theme.effects.buttonShadow,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: theme.colors.white,
      fontSize: theme.fontSize.lg,
      fontWeight: '700',
      fontFamily: theme.fonts.heading,
    },
    hint: {
      textAlign: 'center',
      fontSize: theme.fontSize.xs,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.lg,
      fontFamily: theme.fonts.body,
    },
    hintLink: {
      color: theme.colors.accentLight,
      textDecorationLine: 'underline',
    },
  });
