import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../theme/colors';
import { apiLogin, apiRegister } from '../api/client';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
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
        <View style={styles.logoArea}>
          <Text style={styles.logoIcon}>🤖</Text>
          <Text style={styles.logoTitle}>SciG Mode</Text>
          <Text style={styles.logoSubtitle}>Xiaozhi AI Controller</Text>
        </View>

        {/* Login card */}
        <View style={styles.card}>
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
            placeholderTextColor={Colors.textMuted}
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
            placeholderTextColor={Colors.textMuted}
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
              placeholderTextColor={Colors.textMuted}
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
                  placeholderTextColor={Colors.textMuted}
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
                placeholderTextColor={Colors.textMuted}
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
              <ActivityIndicator color={Colors.white} />
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoIcon: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  logoTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.accentLight,
  },
  logoSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.panel,
    borderWidth: 1,
    borderColor: Colors.panelBorder,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: FontSize.sm,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: 'rgba(2,6,23,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  eyeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  eyeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  hint: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
  },
  hintLink: {
    color: Colors.accentLight,
    textDecorationLine: 'underline',
  },
});
