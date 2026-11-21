import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useAuthStore } from '../store/authStore';
import { getErrorMessage } from '../api/apiClient';
import { strings } from '../strings';
import { colors } from '../theme';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{strings.appName}</Text>
        <Text style={styles.subtitle}>{strings.login}</Text>

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
        />

        <PrimaryButton
          title={strings.login}
          onPress={handleLogin}
          loading={loading}
        />

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => navigation.navigate('Signup')}
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
  apiError: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: colors.primary,
    fontSize: 15,
  },
});
