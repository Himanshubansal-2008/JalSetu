/**
 * InventoryFormScreen.js
 * Single reusable form screen for creating and editing inventory items (Admin only).
 * Handles create vs. edit mode detection, client validation, unit presets,
 * read-only quantity in edit mode, loading states, and error alerts.
 */

import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

const UNIT_PRESETS = ['kg', 'pcs', 'litres', 'bags', 'meters'];

export default function InventoryFormScreen({ route, navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Mode detection: item or itemId present => Edit Mode, otherwise Create Mode
  const passedItem = route.params?.item;
  const itemId =
    route.params?.itemId || route.params?.id || passedItem?.id || null;
  const isEdit = Boolean(itemId || passedItem);

  // Form field state
  const [name, setName] = useState(passedItem?.name || '');
  const [unit, setUnit] = useState(passedItem?.unit || '');
  const [quantity, setQuantity] = useState(
    passedItem?.quantity !== undefined ? String(passedItem.quantity) : '0'
  );
  const [reorderLevel, setReorderLevel] = useState(
    passedItem?.reorderLevel !== undefined
      ? String(passedItem.reorderLevel)
      : '0'
  );

  // Validation & async submission states
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loadingItem, setLoadingItem] = useState(isEdit && !passedItem);

  // Set navigation screen title dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? strings.editInventoryItem : strings.addInventoryItem,
    });
  }, [navigation, isEdit]);

  // In edit mode: if only itemId was passed without item object, fetch from API
  useEffect(() => {
    if (isEdit && !passedItem && itemId) {
      let isMounted = true;
      setLoadingItem(true);
      setSubmitError('');

      apiClient
        .get(`/inventory/${itemId}`)
        .then((response) => {
          if (!isMounted) return;
          const item = response.data?.item;
          if (item) {
            setName(item.name || '');
            setUnit(item.unit || '');
            setQuantity(
              item.quantity !== undefined ? String(item.quantity) : '0'
            );
            setReorderLevel(
              item.reorderLevel !== undefined ? String(item.reorderLevel) : '0'
            );
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          if (err?.response?.status === 401) {
            useAuthStore.getState().logout();
            return;
          }
          setSubmitError(getErrorMessage(err));
        })
        .finally(() => {
          if (isMounted) setLoadingItem(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isEdit, passedItem, itemId]);

  // Field change handlers with automatic error clearing
  const handleNameChange = (val) => {
    setName(val);
    setSubmitError('');
    if (errors.name) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.name;
        return next;
      });
    }
  };

  const handleUnitChange = (val) => {
    setUnit(val);
    setSubmitError('');
    if (errors.unit) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.unit;
        return next;
      });
    }
  };

  const handleQuantityChange = (val) => {
    setQuantity(val);
    setSubmitError('');
    if (errors.quantity) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.quantity;
        return next;
      });
    }
  };

  const handleReorderLevelChange = (val) => {
    setReorderLevel(val);
    setSubmitError('');
    if (errors.reorderLevel) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.reorderLevel;
        return next;
      });
    }
  };

  // Quick unit preset selection
  const handleSelectPresetUnit = (preset) => {
    handleUnitChange(preset);
  };

  // Form validation
  const validate = () => {
    const newErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = strings.errItemNameRequired;
    }

    const trimmedUnit = unit.trim();
    if (!trimmedUnit) {
      newErrors.unit = strings.errUnitRequired;
    }

    if (!isEdit) {
      const trimmedQty = quantity.trim();
      const numQty = Number(trimmedQty);
      if (trimmedQty === '' || isNaN(numQty) || numQty < 0) {
        newErrors.quantity = strings.errQuantityInvalid;
      }
    }

    const trimmedReorder = reorderLevel.trim();
    const numReorder = Number(trimmedReorder);
    if (trimmedReorder === '' || isNaN(numReorder) || numReorder < 0) {
      newErrors.reorderLevel = strings.errReorderLevelInvalid;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSave = async () => {
    if (submitting) return;

    if (!isAdmin) {
      setSubmitError(strings.onlyAdminCanManageInventory);
      return;
    }

    if (!validate()) {
      return;
    }

    setSubmitError('');
    setSubmitting(true);

    try {
      if (isEdit) {
        // Edit Mode: Send PUT /api/inventory/:id with name, unit, reorderLevel (quantity locked)
        const payload = {
          name: name.trim(),
          unit: unit.trim(),
          reorderLevel: Number(reorderLevel.trim()),
        };
        await apiClient.put(`/inventory/${itemId}`, payload);
      } else {
        // Create Mode: Send POST /api/inventory with name, unit, quantity, reorderLevel
        const payload = {
          name: name.trim(),
          unit: unit.trim(),
          quantity: Number(quantity.trim()),
          reorderLevel: Number(reorderLevel.trim()),
        };
        await apiClient.post('/inventory', payload);
      }

      // Return to previous screen so useFocusEffect refetches data
      navigation.goBack();
    } catch (err) {
      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Loading spinner if pre-fetching item in edit mode
  if (loadingItem) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Admin guard warning banner if non-admin accesses form */}
        {!isAdmin ? (
          <View style={styles.adminBanner}>
            <Ionicons
              name="lock-closed"
              size={18}
              color={tones.danger.fg}
              style={styles.bannerIcon}
            />
            <Text style={styles.adminBannerText}>
              {strings.onlyAdminCanManageInventory}
            </Text>
          </View>
        ) : null}

        {/* Backend validation / submission error banner */}
        {submitError ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={tones.danger.fg}
              style={styles.bannerIcon}
            />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        {/* Item Name Field */}
        <FormField
          label={strings.itemNameLabel}
          required={true}
          value={name}
          onChangeText={handleNameChange}
          placeholder={strings.itemNamePlaceholder}
          error={errors.name}
          editable={isAdmin && !submitting}
        />

        {/* Unit Field with Quick-Tap Presets */}
        <View style={styles.unitSection}>
          <FormField
            label={strings.unitLabel}
            required={true}
            value={unit}
            onChangeText={handleUnitChange}
            placeholder={strings.unitPlaceholder}
            error={errors.unit}
            editable={isAdmin && !submitting}
          />

          {/* Quick preset pills */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>Quick presets:</Text>
            <View style={styles.presetPillsRow}>
              {UNIT_PRESETS.map((preset) => {
                const isSelected = unit.toLowerCase() === preset.toLowerCase();
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetPill,
                      isSelected && styles.presetPillSelected,
                    ]}
                    onPress={() => handleSelectPresetUnit(preset)}
                    disabled={!isAdmin || submitting}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={preset}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        isSelected && styles.presetPillTextSelected,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Opening Quantity Field */}
        {isEdit ? (
          <View style={styles.readOnlyFieldWrapper}>
            <Text style={styles.fieldLabel}>
              {strings.quantityLabel}
            </Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyInputText}>
                {quantity} {unit ? unit : ''}
              </Text>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.muted}
              />
            </View>
            <View style={styles.helperRow}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={colors.muted}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.helperNote}>
                {strings.quantityLockedHint}
              </Text>
            </View>
          </View>
        ) : (
          <FormField
            label={strings.quantityLabel}
            required={true}
            value={quantity}
            onChangeText={handleQuantityChange}
            placeholder={strings.quantityPlaceholder}
            keyboardType="numeric"
            error={errors.quantity}
            editable={isAdmin && !submitting}
          />
        )}

        {/* Reorder Level Field */}
        <FormField
          label={strings.reorderLevelLabel}
          required={true}
          value={reorderLevel}
          onChangeText={handleReorderLevelChange}
          placeholder={strings.reorderLevelPlaceholder}
          keyboardType="numeric"
          hint={strings.reorderLevelHint}
          error={errors.reorderLevel}
          editable={isAdmin && !submitting}
        />

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <PrimaryButton
            title={strings.saveItem}
            onPress={handleSave}
            loading={submitting}
            disabled={!isAdmin || submitting}
            variant="primary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    borderWidth: 1,
    borderColor: tones.danger.fg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  adminBannerText: {
    color: tones.danger.fg,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    borderWidth: 1,
    borderColor: tones.danger.fg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: tones.danger.fg,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  bannerIcon: {
    marginRight: spacing.sm,
  },
  unitSection: {
    marginBottom: 0,
  },
  presetsContainer: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  presetsLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  presetPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  presetPill: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  presetPillTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  readOnlyFieldWrapper: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EAEAEA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  readOnlyInputText: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: '500',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  helperNote: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  submitSection: {
    marginTop: spacing.lg,
  },
});
