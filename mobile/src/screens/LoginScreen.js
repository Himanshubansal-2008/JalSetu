import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useAuthStore } from '../store/authStore';
import { getErrorMessage } from '../api/apiClient';
import { strings } from '../strings';
import { colors, tones, radius, spacing } from '../theme';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  // Demo Login states
  const [demoRoleLoading, setDemoRoleLoading] = useState(null); // 'admin' | 'worker' | null

  const login = useAuthStore((state) => state.login);
  const demoLogin = useAuthStore((state) => state.demoLogin);
  const sessionExpiredNotice = useAuthStore((state) => state.sessionExpiredNotice);
  const clearSessionExpiredNotice = useAuthStore((state) => state.clearSessionExpiredNotice);

  const isAnyLoading = loading || Boolean(demoRoleLoading);

  const handleLogin = async () => {
    let isValid = true;
    setPhoneError('');
    setPasswordError('');
    setApiError('');

    // Client-side phone validation: exactly 10 digits
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError(strings.phoneRequired);
      isValid = false;
    }

    // Client-side password validation: minimum 6 characters
    if (!password || password.length < 6) {
      setPasswordError(strings.passwordRequired);
      isValid = false;
    }

    if (!isValid) return;

    try {
      setLoading(true);
      await login(phone, password);
      // Navigation switches automatically via zustand user state change in RootNavigator
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    if (isAnyLoading) return;
    setApiError('');
    setPhoneError('');
    setPasswordError('');
    setDemoRoleLoading(role);

    try {
      await demoLogin({ role });
      // Navigation switches automatically via zustand user state change in RootNavigator
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setDemoRoleLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{strings.appName}</Text>
        <Text style={styles.subtitle}>{strings.login}</Text>

        {sessionExpiredNotice ? (
          <View style={styles.sessionExpiredBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={tones.warning.fg}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.sessionExpiredText}>{sessionExpiredNotice}</Text>
            <TouchableOpacity
              onPress={clearSessionExpiredNotice}
              style={styles.sessionExpiredClose}
              accessibilityRole="button"
              accessibilityLabel="Dismiss session alert"
            >
              <Ionicons name="close" size={16} color={tones.warning.fg} />
            </TouchableOpacity>
          </View>
        ) : null}

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <FormField
          label={strings.phoneLabel}
          placeholder={strings.phonePlaceholder}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (phoneError) setPhoneError('');
          }}
          keyboardType="numeric"
          maxLength={10}
          error={phoneError}
          editable={!isAnyLoading}
        />

        <FormField
          label={strings.passwordLabel}
          placeholder={strings.passwordPlaceholder}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (passwordError) setPasswordError('');
          }}
          secureTextEntry
          error={passwordError}
          editable={!isAnyLoading}
        />

        <PrimaryButton
          title={strings.login}
          onPress={handleLogin}
          loading={loading}
          disabled={isAnyLoading}
        />

        {/* Demo Access Section */}
        <View style={styles.demoSection}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>QUICK DEMO ACCESS</Text>
            <View style={styles.dividerLine} />
          </View>

          {demoRoleLoading ? (
            <View style={styles.demoLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.demoLoadingText}>
                Preparing demo data... (free tier wake-up ~3-5s)
              </Text>
            </View>
          ) : null}

          {/* Demo Admin Button */}
          <TouchableOpacity
            style={[
              styles.demoButton,
              styles.demoAdminButton,
              isAnyLoading && styles.disabledButton,
            ]}
            onPress={() => handleDemoLogin('admin')}
            disabled={isAnyLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.demoAdminButtonText}>
              {demoRoleLoading === 'admin' ? 'Logging in Admin...' : 'Demo Admin Login'}
            </Text>
          </TouchableOpacity>

          {/* Demo Worker Button */}
          <TouchableOpacity
            style={[
              styles.demoButton,
              styles.demoWorkerButton,
              isAnyLoading && styles.disabledButton,
            ]}
            onPress={() => handleDemoLogin('worker')}
            disabled={isAnyLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="construct-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.demoWorkerButtonText}>
              {demoRoleLoading === 'worker' ? 'Logging in Worker...' : 'Demo Worker Login'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => navigation.navigate('Signup')}
          disabled={isAnyLoading}
        >
          <Text style={styles.switchText}>{strings.dontHaveAccount}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  sessionExpiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.warning.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE0B2',
  },
  sessionExpiredText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: tones.warning.fg,
    lineHeight: 18,
  },
  sessionExpiredClose: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  apiError: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  demoSection: {
    marginTop: 24,
    paddingTop: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border || '#E5E7EB',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary || '#6B7280',
    paddingHorizontal: 12,
    letterSpacing: 0.8,
  },
  demoLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tones.info.bg || '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  demoLoadingText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  demoAdminButton: {
    backgroundColor: colors.primary,
  },
  demoAdminButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  demoWorkerButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  demoWorkerButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  switchButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  switchText: {
    color: colors.primary,
    fontSize: 15,
  },
});
