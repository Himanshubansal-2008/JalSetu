/**
 * AssetFormScreen.js
 * Form screen for creating and editing Gram Panchayat water supply assets.
 * Supports add and edit modes, type-specific dynamic attributes, date pickers,
 * client-side validations, dirty-state unsaved changes guard, and partial updates.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ChipSelector from '../components/ChipSelector';
import DateField from '../components/DateField';
import EmptyState from '../components/EmptyState';
import {
  ATTRIBUTE_FIELDS,
  emptyForm,
  assetToForm,
  validateForm,
  buildCreatePayload,
  buildUpdatePayload,
} from '../utils/assetFormUtil';
import { todayString } from '../utils/dateUtil';
import { ASSET_TYPES, ASSET_STATUSES, typeLabel } from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, spacing, radius } from '../theme';

function hasUnsavedChanges(form, base) {
  if (!base) return false;
  if ((form.name || '').trim() !== (base.name || '').trim()) return true;
  if (form.type !== base.type) return true;
  if (form.status !== base.status) return true;
  if (form.installDate !== base.installDate) return true;
  if (form.warrantyExpiry !== base.warrantyExpiry) return true;
  if ((form.lat || '').trim() !== (base.lat || '').trim()) return true;
  if ((form.lng || '').trim() !== (base.lng || '').trim()) return true;
  if ((form.cost || '').trim() !== (base.cost || '').trim()) return true;
  if ((form.notes || '').trim() !== (base.notes || '').trim()) return true;
  if ((form.statusNote || '').trim() !== (base.statusNote || '').trim()) return true;

  const currentAttrs = form.attributes || {};
  const baseAttrs = base.attributes || {};
  const allKeys = new Set([...Object.keys(currentAttrs), ...Object.keys(baseAttrs)]);
  for (const k of allKeys) {
    if ((currentAttrs[k] || '').trim() !== (baseAttrs[k] || '').trim()) {
      return true;
    }
  }

  return false;
}

export default function AssetFormScreen({ route, navigation }) {
  const assetId = route?.params?.id;
  const isEdit = Boolean(assetId);

  // Form state & snapshots
  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(null);

  // UI & Loading states
  const [loadingAsset, setLoadingAsset] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Errors & feedback
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Flag to disable unsaved-changes guard on successful submit
  const saveSuccessRef = useRef(false);

  // Set navigation header title
  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? strings.editAssetTitle : strings.addAssetTitle,
    });
  }, [navigation, isEdit]);

  // Load existing asset in edit mode
  const loadExistingAsset = async () => {
    setLoadingAsset(true);
    setLoadError('');
    setNotFound(false);
    try {
      const response = await apiClient.get(`/assets/${assetId}`);
      const asset = response.data?.asset;
      if (!asset) {
        setNotFound(true);
        return;
      }
      const initialData = assetToForm(asset);
      setForm(initialData);
      setOriginal(initialData);
    } catch (err) {
      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(getErrorMessage(err));
      }
    } finally {
      setLoadingAsset(false);
    }
  };

  useEffect(() => {
    if (isEdit) {
      loadExistingAsset();
    }
  }, [assetId]);

  // Unsaved changes guard
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (saveSuccessRef.current) {
        return;
      }

      const base = isEdit ? original : emptyForm();
      if (!base) return;

      if (!hasUnsavedChanges(form, base)) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        strings.discardChangesTitle,
        strings.discardChangesMessage,
        [
          { text: strings.keepEditing, style: 'cancel' },
          {
            text: strings.discard,
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, form, original, isEdit]);

  // Field change helpers
  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSubmitError('');
    setInfoMessage('');
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleTypeChange = (newType) => {
    setForm((prev) => ({
      ...prev,
      type: newType,
      attributes: {}, // Reset attributes on type change
    }));
    setSubmitError('');
    setInfoMessage('');
    if (errors.type) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.type;
        return next;
      });
    }
  };

  const updateAttribute = (attrKey, value) => {
    setForm((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attrKey]: value,
      },
    }));
    setSubmitError('');
    setInfoMessage('');
    if (errors.attributes && errors.attributes[attrKey]) {
      setErrors((prev) => {
        const nextAttrs = { ...prev.attributes };
        delete nextAttrs[attrKey];
        return { ...prev, attributes: nextAttrs };
      });
    }
  };

  // Submit handler
  const handleSave = async () => {
    if (submitting) return;

    setSubmitError('');
    setInfoMessage('');

    const { valid, errors: validationErrors } = validateForm(form, {
      mode: isEdit ? 'edit' : 'add',
      today: todayString(),
    });

    if (!valid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    if (isEdit) {
      const payload = buildUpdatePayload(form, original);
      if (Object.keys(payload).length === 0) {
        setInfoMessage(strings.noChangesToSave);
        return;
      }

      setSubmitting(true);
      try {
        await apiClient.patch(`/assets/${assetId}`, payload);
        saveSuccessRef.current = true;
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
    } else {
      const payload = buildCreatePayload(form);
      setSubmitting(true);
      try {
        await apiClient.post('/assets', payload);
        saveSuccessRef.current = true;
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
    }
  };

  // Loading state in edit mode
  if (loadingAsset) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 404 Not Found state
  if (notFound) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message={strings.assetNotFound}
          actionLabel={strings.goBack}
          onAction={() => navigation.goBack()}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  // Fetch load error state
  if (loadError) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message={loadError}
          actionLabel={strings.retry}
          onAction={loadExistingAsset}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  const typeFields = ATTRIBUTE_FIELDS[form.type] || [];
  const showStatusNote = isEdit && form.status !== original?.status;
  const hasValidationErrors =
    Object.keys(errors).filter((k) => k !== 'attributes').length > 0 ||
    Object.keys(errors.attributes || {}).length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Name */}
        <FormField
          label={strings.assetNameLabel}
          placeholder={strings.assetNamePlaceholder}
          value={form.name}
          onChangeText={(text) => updateField('name', text)}
          required={true}
          error={errors.name ? strings[errors.name] : undefined}
        />

        {/* 2. Type */}
        {isEdit ? (
          <View style={styles.readOnlyContainer}>
            <Text style={styles.readOnlyLabel}>{strings.typeLabel}</Text>
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyText}>{typeLabel(form.type)}</Text>
            </View>
            <Text style={styles.hintText}>{strings.typeCannotBeChanged}</Text>
          </View>
        ) : (
          <View style={styles.sectionMargin}>
            <ChipSelector
              label={strings.typeLabel}
              options={ASSET_TYPES}
              value={form.type}
              onChange={handleTypeChange}
              scrollable={false}
              allowDeselect={false}
              error={errors.type ? strings[errors.type] : undefined}
            />
          </View>
        )}

        {/* 3. Status */}
        <View style={styles.sectionMargin}>
          <ChipSelector
            label={strings.statusLabel}
            options={ASSET_STATUSES}
            value={form.status}
            onChange={(val) => updateField('status', val)}
            scrollable={false}
            allowDeselect={false}
          />
        </View>

        {/* 4. Install Date */}
        <DateField
          label={strings.installDateLabel}
          value={form.installDate}
          onChange={(val) => updateField('installDate', val)}
          maximumDate={todayString()}
          error={errors.installDate ? strings[errors.installDate] : undefined}
        />

        {/* 5. Type-Specific Attributes Section */}
        {typeFields.length > 0 ? (
          <View style={styles.attributesSection}>
            {typeFields.map((field) => (
              <FormField
                key={field.key}
                label={strings[field.label]}
                value={form.attributes[field.key] || ''}
                onChangeText={(text) => updateAttribute(field.key, text)}
                keyboardType={field.kind === 'number' ? 'decimal-pad' : 'default'}
                error={
                  errors.attributes && errors.attributes[field.key]
                    ? strings[errors.attributes[field.key]]
                    : undefined
                }
              />
            ))}
          </View>
        ) : null}

        {/* 6. Location: Latitude and Longitude */}
        <View style={styles.locationContainer}>
          <View style={styles.coordsRow}>
            <View style={styles.coordField}>
              <FormField
                label={strings.latLabel}
                placeholder={strings.latPlaceholder}
                value={form.lat}
                onChangeText={(text) => updateField('lat', text)}
                keyboardType={
                  Platform.OS === 'ios'
                    ? 'numbers-and-punctuation'
                    : 'decimal-pad'
                }
                error={errors.lat ? strings[errors.lat] : undefined}
              />
            </View>
            <View style={styles.coordField}>
              <FormField
                label={strings.lngLabel}
                placeholder={strings.lngPlaceholder}
                value={form.lng}
                onChangeText={(text) => updateField('lng', text)}
                keyboardType={
                  Platform.OS === 'ios'
                    ? 'numbers-and-punctuation'
                    : 'decimal-pad'
                }
                error={errors.lng ? strings[errors.lng] : undefined}
              />
            </View>
          </View>
          <Text style={styles.hintText}>{strings.locationHint}</Text>
        </View>

        {/* 7. Cost in rupees */}
        <FormField
          label={strings.costLabel}
          placeholder={strings.costPlaceholder}
          value={form.cost}
          onChangeText={(text) => updateField('cost', text)}
          keyboardType="decimal-pad"
          error={errors.cost ? strings[errors.cost] : undefined}
        />

        {/* 8. Warranty Expiry */}
        <DateField
          label={strings.warrantyExpiryLabel}
          value={form.warrantyExpiry}
          onChange={(val) => updateField('warrantyExpiry', val)}
        />

        {/* 9. Notes */}
        <FormField
          label={strings.notesLabel}
          placeholder={strings.notesPlaceholder}
          value={form.notes}
          onChangeText={(text) => updateField('notes', text)}
          multiline={true}
          error={errors.notes ? strings[errors.notes] : undefined}
        />

        {/* 10. Reason for status change (in edit mode only, if status changed) */}
        {showStatusNote ? (
          <FormField
            label={strings.statusNoteLabel}
            placeholder={strings.statusNotePlaceholder}
            value={form.statusNote}
            onChangeText={(text) => updateField('statusNote', text)}
            multiline={true}
            error={errors.statusNote ? strings[errors.statusNote] : undefined}
          />
        ) : null}

        {/* Feedback messages */}
        {hasValidationErrors ? (
          <Text style={styles.errorBannerText}>{strings.fixHighlightedErrors}</Text>
        ) : null}

        {submitError ? (
          <Text style={styles.errorBannerText}>{submitError}</Text>
        ) : null}

        {infoMessage ? (
          <Text style={styles.infoBannerText}>{infoMessage}</Text>
        ) : null}

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={strings.save}
            onPress={handleSave}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  sectionMargin: {
    marginBottom: spacing.xs,
  },
  readOnlyContainer: {
    marginBottom: spacing.lg,
  },
  readOnlyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  readOnlyBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  attributesSection: {
    marginBottom: spacing.sm,
  },
  locationContainer: {
    marginBottom: spacing.lg,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coordField: {
    flex: 1,
  },
  hintText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoBannerText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
