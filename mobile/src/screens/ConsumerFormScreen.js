/**
 * ConsumerFormScreen.js
 * Reusable Add / Edit Consumer form screen in the JalSetu mobile app.
 *
 * Supports:
 * - Create Mode: Adds new consumer with name, houseNumber, phone, monthlyChargePaise
 * - Edit Mode: Pre-fills existing consumer data, allows updates, and soft-deactivate/reactivate
 * - Validates integer paise math via rupeesInputToPaise
 * - Preserves billing history on deactivation
 */

import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { rupeesInputToPaise } from '../utils/currency';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

export default function ConsumerFormScreen({ route, navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  const existingConsumer = route.params?.consumer;
  const isEdit = !!existingConsumer;

  // Form state
  const [name, setName] = useState(existingConsumer?.name || '');
  const [houseNumber, setHouseNumber] = useState(
    existingConsumer?.houseNumber || ''
  );
  const [phone, setPhone] = useState(existingConsumer?.phone || '');
  const [monthlyCharge, setMonthlyCharge] = useState(
    existingConsumer?.monthlyChargePaise != null
      ? (existingConsumer.monthlyChargePaise / 100).toString()
      : ''
  );
  const [isActive, setIsActive] = useState(
    existingConsumer?.isActive !== undefined ? existingConsumer.isActive : true
  );

  // Validation & loading states
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Set navigation title
  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? strings.editConsumer : strings.addConsumer,
    });
  }, [navigation, isEdit]);

  // Admin route guard
  if (!isAdmin) {
    return (
      <View style={styles.guardContainer}>
        <Ionicons name="shield-outline" size={56} color={colors.muted} />
        <Text style={styles.guardTitle}>{strings.adminAccessOnly}</Text>
        <Text style={styles.guardMessage}>{strings.adminAccessOnlyMessage}</Text>
      </View>
    );
  }

  // Validate form inputs
  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = strings.nameCannotBeEmpty;
    }
    if (!houseNumber.trim()) {
      errs.houseNumber = strings.houseNumberCannotBeEmpty;
    }
    if (!phone.trim()) {
      errs.phone = strings.phoneCannotBeEmpty;
    }

    const paise = rupeesInputToPaise(monthlyCharge);
    if (paise === null || paise <= 0) {
      errs.monthlyCharge = strings.monthlyChargeMustBePositive;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit form handler
  const handleSubmit = async () => {
    setServerError('');
    if (!validate()) return;

    const monthlyChargePaise = rupeesInputToPaise(monthlyCharge);
    setSubmitting(true);

    try {
      if (isEdit) {
        await apiClient.put(`/consumers/${existingConsumer.id}`, {
          name: name.trim(),
          houseNumber: houseNumber.trim(),
          phone: phone.trim(),
          monthlyChargePaise,
          isActive,
        });
      } else {
        await apiClient.post('/consumers', {
          name: name.trim(),
          houseNumber: houseNumber.trim(),
          phone: phone.trim(),
          monthlyChargePaise,
        });
      }

      navigation.goBack();
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Direct Deactivate Action with Confirmation Alert
  const handleDeactivate = () => {
    Alert.alert(
      strings.deactivateConsumerConfirmTitle,
      strings.deactivateConsumerConfirmMessage,
      [
        { text: strings.cancel || 'Cancel', style: 'cancel' },
        {
          text: strings.deactivateConsumer,
          style: 'destructive',
          onPress: async () => {
            setDeactivating(true);
            setServerError('');
            try {
              await apiClient.post(
                `/consumers/${existingConsumer.id}/deactivate`
              );
              navigation.goBack();
            } catch (err) {
              setServerError(getErrorMessage(err));
            } finally {
              setDeactivating(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error Banner */}
        {serverError ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.danger}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={styles.errorBannerText}>{serverError}</Text>
          </View>
        ) : null}

        {/* Consumer Form Card */}
        <View style={styles.formCard}>
          <FormField
            label={strings.consumerNameLabel}
            placeholder={strings.consumerNamePlaceholder}
            value={name}
            onChangeText={(val) => {
              setName(val);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            error={errors.name}
            required
            autoCapitalize="words"
          />

          <FormField
            label={strings.houseNumberLabel}
            placeholder={strings.houseNumberPlaceholder}
            value={houseNumber}
            onChangeText={(val) => {
              setHouseNumber(val);
              if (errors.houseNumber)
                setErrors((prev) => ({ ...prev, houseNumber: '' }));
            }}
            error={errors.houseNumber}
            required
            autoCapitalize="characters"
          />

          <FormField
            label={strings.phoneLabel}
            placeholder={strings.phonePlaceholder}
            value={phone}
            onChangeText={(val) => {
              setPhone(val);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
            }}
            error={errors.phone}
            required
            keyboardType="phone-pad"
          />

          <FormField
            label={strings.monthlyChargeLabel}
            placeholder={strings.monthlyChargePlaceholder}
            value={monthlyCharge}
            onChangeText={(val) => {
              setMonthlyCharge(val);
              if (errors.monthlyCharge)
                setErrors((prev) => ({ ...prev, monthlyCharge: '' }));
            }}
            error={errors.monthlyCharge}
            required
            keyboardType="decimal-pad"
          />

          {/* Active / Inactive Status Toggle (Edit Mode Only) */}
          {isEdit ? (
            <View style={styles.statusSection}>
              <Text style={styles.statusSectionTitle}>
                {strings.statusToggleLabel}
              </Text>
              <View style={styles.statusToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    isActive && styles.statusPillActive,
                  ]}
                  onPress={() => setIsActive(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color={isActive ? tones.success.fg : colors.muted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      isActive && styles.statusPillTextActive,
                    ]}
                  >
                    {strings.activeStatus}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    !isActive && styles.statusPillInactive,
                  ]}
                  onPress={() => setIsActive(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={16}
                    color={!isActive ? colors.danger : colors.muted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      !isActive && styles.statusPillTextInactive,
                    ]}
                  >
                    {strings.inactiveStatus}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <PrimaryButton
            title={
              submitting
                ? strings.saving
                : isEdit
                ? strings.editConsumer
                : strings.addConsumer
            }
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || deactivating}
          />
        </View>

        {/* Destructive Deactivate Button (Edit Mode Only when Active) */}
        {isEdit && existingConsumer.isActive ? (
          <View style={styles.deactivateContainer}>
            <TouchableOpacity
              style={styles.deactivateButton}
              onPress={handleDeactivate}
              disabled={submitting || deactivating}
              activeOpacity={0.8}
            >
              {deactivating ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons
                    name="person-remove-outline"
                    size={18}
                    color={colors.danger}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text style={styles.deactivateButtonText}>
                    {strings.deactivateConsumer}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.deactivateHelpText}>
              {strings.deactivateConsumerConfirmMessage}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  guardContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  guardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  guardMessage: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: tones.danger.fg,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  statusSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 44,
  },
  statusPillActive: {
    backgroundColor: tones.success.bg,
    borderColor: tones.success.fg,
  },
  statusPillInactive: {
    backgroundColor: tones.danger.bg,
    borderColor: colors.danger,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  statusPillTextActive: {
    color: tones.success.fg,
  },
  statusPillTextInactive: {
    color: colors.danger,
  },
  submitContainer: {
    marginBottom: spacing.lg,
  },
  deactivateContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  deactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.white,
    width: '100%',
    minHeight: 46,
  },
  deactivateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  deactivateHelpText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
