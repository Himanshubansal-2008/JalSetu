import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useAuthStore } from '../store/authStore';
import { getErrorMessage } from '../api/apiClient';
import { strings } from '../strings';
import { colors } from '../theme';

export default function SignupScreen({ navigation }) {
  const [gpName, setGpName] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = useAuthStore((s) => s.signup);

  const handleSignup = async () => {
    const newErrors = {};
    setApiError('');

    // Client-side validations matching backend contract
    if (!gpName || gpName.trim().length < 2) {
      newErrors.gpName = strings.gpNameRequired;
    }
    if (!village || village.trim().length < 2) {
      newErrors.village = strings.villageRequired;
    }
    if (!district || district.trim().length < 2) {
      newErrors.district = strings.districtRequired;
    }
    if (!state || state.trim().length < 2) {
      newErrors.state = strings.stateRequired;
    }
    if (!name || name.trim().length < 2) {
      newErrors.name = strings.nameRequired;
    }
    if (!/^\d{10}$/.test(phone)) {
      newErrors.phone = strings.phoneRequired;
    }
    if (!password || password.length < 6) {
      newErrors.password = strings.passwordRequired;
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setLoading(true);
      await signup({
        gpName: gpName.trim(),
        village: village.trim(),
        district: district.trim(),
        state: state.trim(),
        name: name.trim(),
        phone: phone.trim(),
        password,
      });
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
        <Text style={styles.subtitle}>{strings.createAccount}</Text>

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <FormField
          label={strings.gpNameLabel}
          placeholder={strings.gpNamePlaceholder}
          value={gpName}
          onChangeText={(v) => {
            setGpName(v);
            if (errors.gpName) setErrors((prev) => ({ ...prev, gpName: '' }));
          }}
          error={errors.gpName}
        />

        <FormField
          label={strings.villageLabel}
          placeholder={strings.villagePlaceholder}
          value={village}
          onChangeText={(v) => {
            setVillage(v);
            if (errors.village) setErrors((prev) => ({ ...prev, village: '' }));
          }}
          error={errors.village}
        />

        <FormField
          label={strings.districtLabel}
          placeholder={strings.districtPlaceholder}
          value={district}
          onChangeText={(v) => {
            setDistrict(v);
            if (errors.district) setErrors((prev) => ({ ...prev, district: '' }));
          }}
          error={errors.district}
        />

        <FormField
          label={strings.stateLabel}
          placeholder={strings.statePlaceholder}
          value={state}
          onChangeText={(v) => {
            setState(v);
            if (errors.state) setErrors((prev) => ({ ...prev, state: '' }));
          }}
          error={errors.state}
        />

        <FormField
          label={strings.nameLabel}
          placeholder={strings.namePlaceholder}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          error={errors.name}
        />

        <FormField
          label={strings.phoneLabel}
          placeholder={strings.phonePlaceholder}
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
          }}
          keyboardType="numeric"
          maxLength={10}
          error={errors.phone}
        />

        <FormField
          label={strings.passwordLabel}
          placeholder={strings.passwordPlaceholder}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
          }}
          secureTextEntry
          error={errors.password}
        />

        <PrimaryButton
          title={strings.createAccount}
          onPress={handleSignup}
          loading={loading}
        />

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.switchText}>{strings.alreadyHaveAccount}</Text>
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
    padding: 24,
    paddingTop: 40,
    paddingBottom: 40,
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
