/**
 * FinanceEntryFormScreen.js
 * Unified Add / Edit form screen for both Receipts and Expenses.
 * Features:
 * - Top segmented toggle in Create Mode (Receipt vs. Expense)
 * - Locked entry type in Edit Mode
 * - Decimal amount input converted to integer paise via rupeesInputToPaise
 * - Selectable category chips matching backend models
 * - Selectable payment mode pills (Cash, UPI, Cheque)
 * - Timezone-safe date input with native DateField picker and quick Today/Yesterday chips
 * - Optional reference/UTR input
 * - Optional description multi-line input
 * - Searchable asset picker modal for linked expenses
 * - Robust submission handling with loading spinner and error surfacing
 */

import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import FormField from '../components/FormField';
import DateField from '../components/DateField';
import PrimaryButton from '../components/PrimaryButton';
import { rupeesInputToPaise } from '../utils/currency';
import { paiseToRupees } from '../utils/moneyUtil';
import { todayString, dateToString, isoToDateString } from '../utils/dateUtil';
import { typeLabel } from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

const RECEIPT_CATEGORIES = ['Grant', 'Water tax', 'Donation', 'Other'];
const EXPENSE_CATEGORIES = [
  'Repair',
  'Purchase',
  'Electricity',
  'Salary',
  'Other',
];
const PAYMENT_MODES = ['Cash', 'UPI', 'Cheque'];

export default function FinanceEntryFormScreen({ route, navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  const entry = route.params?.entry || null;
  const isEdit = Boolean(entry);

  const rawInitialType =
    route.params?.initialType ||
    route.params?.mode ||
    entry?.type ||
    'RECEIPT';
  const initialType = String(rawInitialType).toUpperCase() === 'EXPENSE' ? 'EXPENSE' : 'RECEIPT';

  // Entry type state
  const [entryType, setEntryType] = useState(initialType);

  // Form fields state
  const [amountText, setAmountText] = useState(() => {
    if (entry) {
      const p = entry.amountPaise != null ? entry.amountPaise : entry.amount;
      return p != null ? paiseToRupees(p) : '';
    }
    return '';
  });

  const [category, setCategory] = useState(() => {
    if (entry?.category) return entry.category;
    return initialType === 'RECEIPT' ? RECEIPT_CATEGORIES[0] : EXPENSE_CATEGORIES[0];
  });

  const [paymentMode, setPaymentMode] = useState(() => {
    return entry?.mode || 'Cash';
  });

  const [date, setDate] = useState(() => {
    if (entry?.date) {
      return isoToDateString(entry.date) || todayString();
    }
    return todayString();
  });

  const [reference, setReference] = useState(() => {
    return entry?.reference || '';
  });

  const [description, setDescription] = useState(() => {
    return entry?.description || '';
  });

  const [selectedAssetId, setSelectedAssetId] = useState(() => {
    return entry?.assetId || entry?.asset?.id || null;
  });

  // UI & validation state
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Assets modal state (Expense mode only)
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

  // Dynamic header title
  useLayoutEffect(() => {
    let title;
    if (isEdit) {
      title =
        entryType === 'RECEIPT'
          ? strings.editReceiptTitle
          : strings.editExpenseTitle;
    } else {
      title =
        entryType === 'RECEIPT'
          ? strings.addReceiptTitle
          : strings.addExpenseTitle;
    }
    navigation.setOptions({ title });
  }, [navigation, isEdit, entryType]);

  // Fetch GP assets when in EXPENSE mode
  useEffect(() => {
    if (entryType === 'EXPENSE') {
      let isMounted = true;
      setLoadingAssets(true);
      apiClient
        .get('/assets', { params: { limit: 100 } })
        .then((res) => {
          if (!isMounted) return;
          const list = res.data?.assets || [];
          setAssets(list);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingAssets(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [entryType]);

  // Switch between Receipt and Expense in Create Mode
  const handleTypeChange = (type) => {
    if (isEdit || type === entryType) return;
    setEntryType(type);
    setSubmitError('');
    // Reset category to first valid option for that type
    if (type === 'RECEIPT') {
      setCategory(RECEIPT_CATEGORIES[0]);
      setSelectedAssetId(null);
    } else {
      setCategory(EXPENSE_CATEGORIES[0]);
    }
  };

  // Amount validation
  const amountPaise = rupeesInputToPaise(amountText);
  const isAmountValid = amountPaise !== null && amountPaise > 0;
  const amountError =
    amountTouched && !isAmountValid ? strings.errAmountPositive : '';

  // Quick Date Chips
  const setTodayDate = () => {
    setDate(todayString());
    setSubmitError('');
  };

  const setYesterdayDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(dateToString(d));
    setSubmitError('');
  };

  // Selected asset object
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [selectedAssetId, assets]);

  // Filtered assets for modal
  const filteredAssets = useMemo(() => {
    if (!assetSearchQuery.trim()) return assets;
    const q = assetSearchQuery.trim().toLowerCase();
    return assets.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        typeLabel(a.type)?.toLowerCase().includes(q)
    );
  }, [assets, assetSearchQuery]);

  // Submit Handler
  const handleSubmit = async () => {
    setAmountTouched(true);
    if (!isAmountValid) {
      setSubmitError(strings.errAmountPositive);
      return;
    }
    if (!date) {
      setSubmitError('Please select a valid date');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      if (isEdit) {
        // Edit Entry (PUT /api/finance/entries/:id)
        const updatePayload = {
          category,
          amountPaise,
          date,
          mode: paymentMode,
          description: description.trim() || null,
          reference: reference.trim() || null,
        };

        if (entryType === 'EXPENSE') {
          updatePayload.assetId = selectedAssetId || null;
        }

        await apiClient.put(`/finance/entries/${entry.id}`, updatePayload);
      } else {
        // Create Mode
        if (entryType === 'RECEIPT') {
          // POST /api/finance/receipts
          await apiClient.post('/finance/receipts', {
            category,
            amountPaise,
            date,
            mode: paymentMode,
            reference: reference.trim() || undefined,
            description: description.trim() || undefined,
          });
        } else {
          // POST /api/finance/expenses
          await apiClient.post('/finance/expenses', {
            category,
            amountPaise,
            date,
            mode: paymentMode,
            description: description.trim() || undefined,
            assetId: selectedAssetId || undefined,
            reference: reference.trim() || undefined,
          });
        }
      }

      navigation.goBack();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Non-admin route guard
  if (!isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.danger} />
        <Text style={styles.unauthorizedTitle}>{strings.adminAccessOnly}</Text>
        <Text style={styles.unauthorizedMessage}>
          {strings.adminAccessOnlyMessage}
        </Text>
      </View>
    );
  }

  const currentCategories =
    entryType === 'RECEIPT' ? RECEIPT_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Type Selector (Segmented Toggle in Create Mode, Locked in Edit Mode) */}
        {!isEdit ? (
          <View style={styles.typeToggleContainer}>
            <TouchableOpacity
              style={[
                styles.typeToggleTab,
                entryType === 'RECEIPT' && styles.typeToggleTabReceiptActive,
              ]}
              onPress={() => handleTypeChange('RECEIPT')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-down-circle"
                size={18}
                color={
                  entryType === 'RECEIPT' ? colors.white : tones.success.fg
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.typeToggleText,
                  entryType === 'RECEIPT' && styles.typeToggleTextActive,
                ]}
              >
                {strings.receipt}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeToggleTab,
                entryType === 'EXPENSE' && styles.typeToggleTabExpenseActive,
              ]}
              onPress={() => handleTypeChange('EXPENSE')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-up-circle"
                size={18}
                color={
                  entryType === 'EXPENSE' ? colors.white : tones.danger.fg
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.typeToggleText,
                  entryType === 'EXPENSE' && styles.typeToggleTextActive,
                ]}
              >
                {strings.expense}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.lockedTypeBadge}>
            <Ionicons
              name={
                entryType === 'RECEIPT'
                  ? 'arrow-down-circle'
                  : 'arrow-up-circle'
              }
              size={18}
              color={
                entryType === 'RECEIPT' ? tones.success.fg : tones.danger.fg
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.lockedTypeText,
                {
                  color:
                    entryType === 'RECEIPT'
                      ? tones.success.fg
                      : tones.danger.fg,
                },
              ]}
            >
              {entryType === 'RECEIPT' ? strings.receipt : strings.expense} (Locked)
            </Text>
          </View>
        )}

        {/* 2. Amount Input */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            {strings.amountLabel} <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <View
            style={[
              styles.amountInputRow,
              amountError ? styles.inputErrorBorder : null,
            ]}
          >
            <Text style={styles.rupeePrefix}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amountText}
              onChangeText={(text) => {
                setAmountText(text);
                setSubmitError('');
                if (!amountTouched) setAmountTouched(true);
              }}
              placeholder={strings.amountPlaceholder}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              editable={!submitting}
              autoFocus={!isEdit}
            />
          </View>
          {amountError ? (
            <Text style={styles.fieldErrorText}>{amountError}</Text>
          ) : null}
        </View>

        {/* 3. Category Selector */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            {strings.categoryLabel} <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <View style={styles.chipsWrap}>
            {currentCategories.map((cat) => {
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    isSelected
                      ? entryType === 'RECEIPT'
                        ? styles.chipReceiptSelected
                        : styles.chipExpenseSelected
                      : styles.chipUnselected,
                  ]}
                  onPress={() => {
                    setCategory(cat);
                    setSubmitError('');
                  }}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Payment Mode */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            {strings.paymentModeLabel} <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <View style={styles.chipsWrap}>
            {PAYMENT_MODES.map((pm) => {
              const isSelected = paymentMode === pm;
              return (
                <TouchableOpacity
                  key={pm}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipModeSelected : styles.chipUnselected,
                  ]}
                  onPress={() => {
                    setPaymentMode(pm);
                    setSubmitError('');
                  }}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                    ]}
                  >
                    {pm}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 5. Date Field + Quick Date Chips */}
        <View style={styles.fieldContainer}>
          <View style={styles.dateLabelRow}>
            <Text style={styles.fieldLabel}>
              {strings.dateLabel} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={styles.quickDateChipsRow}>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={setTodayDate}
                disabled={submitting}
              >
                <Text style={styles.quickDateChipText}>{strings.today}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={setYesterdayDate}
                disabled={submitting}
              >
                <Text style={styles.quickDateChipText}>{strings.yesterday}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <DateField
            value={date}
            onChange={(val) => {
              setDate(val);
              setSubmitError('');
            }}
          />
        </View>

        {/* 6. Linked Asset Picker (Expense mode only) */}
        {entryType === 'EXPENSE' ? (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{strings.linkedAssetLabel}</Text>
            <TouchableOpacity
              style={styles.selectorInput}
              onPress={() => setAssetModalVisible(true)}
              disabled={submitting || loadingAssets}
              activeOpacity={0.7}
            >
              {loadingAssets ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <View style={styles.selectorValueContainer}>
                    {selectedAsset ? (
                      <View style={styles.selectedAssetRow}>
                        <Ionicons
                          name="cube-outline"
                          size={18}
                          color={colors.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={styles.selectorValueText}
                          numberOfLines={1}
                        >
                          {selectedAsset.name} • {typeLabel(selectedAsset.type)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.selectorPlaceholderText}>
                        {strings.noneGeneralExpense}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={colors.muted}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 7. Reference (Receipt or Expense) */}
        <FormField
          label={strings.referenceLabel}
          value={reference}
          onChangeText={(val) => {
            setReference(val);
            setSubmitError('');
          }}
          placeholder={strings.referencePlaceholder}
          editable={!submitting}
          maxLength={100}
        />

        {/* 8. Description / Note */}
        <FormField
          label={strings.descriptionLabel}
          value={description}
          onChangeText={(val) => {
            setDescription(val);
            setSubmitError('');
          }}
          placeholder={strings.descriptionPlaceholder}
          multiline={true}
          numberOfLines={3}
          editable={!submitting}
          maxLength={500}
        />

        {/* Error Banner */}
        {submitError ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle"
              size={20}
              color={tones.danger.fg}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <PrimaryButton
            title={
              isEdit
                ? strings.updateEntry
                : entryType === 'RECEIPT'
                ? strings.recordReceipt
                : strings.recordExpense
            }
            onPress={handleSubmit}
            loading={submitting}
            disabled={!isAmountValid || submitting}
            variant={entryType === 'RECEIPT' ? 'success' : 'primary'}
          />
        </View>
      </ScrollView>

      {/* Asset Search & Select Modal (Expense mode only) */}
      {entryType === 'EXPENSE' ? (
        <Modal
          visible={assetModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAssetModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{strings.linkedAssetLabel}</Text>
              <TouchableOpacity
                onPress={() => setAssetModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Asset Search */}
            <View style={styles.modalSearchWrapper}>
              <View style={styles.modalSearchContainer}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={colors.muted}
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder={strings.searchAssetsPlaceholder}
                  placeholderTextColor={colors.muted}
                  value={assetSearchQuery}
                  onChangeText={setAssetSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {assetSearchQuery ? (
                  <TouchableOpacity
                    onPress={() => setAssetSearchQuery('')}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Asset List */}
            <FlatList
              data={filteredAssets}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalListContent}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[
                    styles.assetItem,
                    selectedAssetId === null && styles.assetItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedAssetId(null);
                    setAssetModalVisible(false);
                    setSubmitError('');
                  }}
                >
                  <View style={styles.assetItemContent}>
                    <Text
                      style={[
                        styles.assetItemName,
                        selectedAssetId === null && styles.assetItemNameSelected,
                      ]}
                    >
                      {strings.noneGeneralExpense}
                    </Text>
                  </View>
                  {selectedAssetId === null ? (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              }
              renderItem={({ item }) => {
                const isSelected = selectedAssetId === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.assetItem,
                      isSelected && styles.assetItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedAssetId(item.id);
                      setAssetModalVisible(false);
                      setSubmitError('');
                    }}
                  >
                    <View style={styles.assetItemContent}>
                      <Text
                        style={[
                          styles.assetItemName,
                          isSelected && styles.assetItemNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.assetItemSubtitle}>
                        {typeLabel(item.type)}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Modal>
      ) : null}
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
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  unauthorizedMessage: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeToggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md - 2,
  },
  typeToggleTabReceiptActive: {
    backgroundColor: tones.success.fg,
  },
  typeToggleTabExpenseActive: {
    backgroundColor: tones.danger.fg,
  },
  typeToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  typeToggleTextActive: {
    color: colors.white,
  },
  lockedTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  lockedTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  requiredAsterisk: {
    color: colors.danger,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  rupeePrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 0,
  },
  inputErrorBorder: {
    borderColor: colors.danger,
  },
  fieldErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipUnselected: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  chipReceiptSelected: {
    backgroundColor: tones.success.bg,
    borderColor: tones.success.fg,
  },
  chipExpenseSelected: {
    backgroundColor: tones.danger.bg,
    borderColor: tones.danger.fg,
  },
  chipModeSelected: {
    backgroundColor: tones.info.bg,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextUnselected: {
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickDateChip: {
    backgroundColor: tones.neutral.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  quickDateChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: tones.neutral.fg,
  },
  selectorInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  selectorValueContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  selectedAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorValueText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  selectorPlaceholderText: {
    fontSize: 14,
    color: colors.muted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: tones.danger.fg,
    fontWeight: '500',
  },
  submitContainer: {
    marginTop: spacing.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalSearchWrapper: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  modalListContent: {
    padding: spacing.lg,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assetItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F7FF',
  },
  assetItemContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  assetItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  assetItemNameSelected: {
    color: colors.primary,
  },
  assetItemSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
});
