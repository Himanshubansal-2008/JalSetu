/**
 * StockTransactionScreen.js
 * Unified form screen for recording Stock IN and Stock OUT transactions.
 * Features:
 * - Admin route/screen guard: Non-admins blocked from Stock IN
 * - Available stock status banner
 * - Quantity numeric input with adjacent unit label
 * - Client-side validation: Number(quantity) > 0
 * - Searchable modal picker for "Used at" asset (Stock OUT only)
 * - Optional note input
 * - Inline backend error banner & alert popup without resetting inputs
 * - Pulls or updates immediately on navigation back
 */

import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { typeLabel } from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

export default function StockTransactionScreen({
  route,
  navigation,
  mode: propMode,
}) {
  const {
    itemId: paramItemId,
    id: paramId,
    item: paramItem,
    name: paramName,
    itemName: paramItemName,
    unit: paramUnit,
    currentQuantity: paramCurrentQuantity,
    availableQuantity: paramAvailableQuantity,
    mode: paramMode,
  } = route.params || {};

  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  const itemId = paramItemId || paramId || paramItem?.id;
  const itemName = paramItemName || paramName || paramItem?.name || 'Item';
  const unit = paramUnit || paramItem?.unit || '';
  const availableQuantity =
    paramAvailableQuantity ??
    paramCurrentQuantity ??
    paramItem?.quantity ??
    0;

  const mode = propMode || paramMode || 'OUT';
  const isStockIn = mode === 'IN';

  // Form states
  const [quantity, setQuantity] = useState('');
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [note, setNote] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  // Asset picker states (Stock OUT only)
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(!isStockIn);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetModalVisible, setAssetModalVisible] = useState(false);

  // Submission & error states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Configure screen header title
  useLayoutEffect(() => {
    navigation.setOptions({
      title: isStockIn
        ? `Add Stock — ${itemName}`
        : `Use Stock — ${itemName}`,
    });
  }, [navigation, isStockIn, itemName]);

  // Route / Screen Guard: Non-admins cannot access Stock IN
  if (isStockIn && !isAdmin) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message={strings.adminAccessRequiredStockIn}
          actionLabel="Go Back"
          onAction={() => navigation.goBack()}
          icon="lock-closed-outline"
        />
      </View>
    );
  }

  // Fetch GP assets for Stock OUT dropdown
  useEffect(() => {
    if (!isStockIn) {
      let isMounted = true;
      setLoadingAssets(true);

      apiClient
        .get('/assets')
        .then((response) => {
          if (!isMounted) return;
          const list = response.data?.assets || [];
          setAssets(list);
        })
        .catch(() => {
          // If fetching assets fails, keep assets empty
        })
        .finally(() => {
          if (isMounted) setLoadingAssets(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isStockIn]);

  // Client-side quantity validation: Number(quantity) > 0 and integer
  const numQuantity = Number(quantity.trim());
  const isQuantityValid =
    quantity.trim() !== '' &&
    !isNaN(numQuantity) &&
    numQuantity > 0 &&
    Number.isInteger(numQuantity);

  const quantityError =
    quantityTouched && !isQuantityValid
      ? !Number.isInteger(numQuantity) && !isNaN(numQuantity) && numQuantity > 0
        ? 'Quantity must be a whole number'
        : strings.errQuantityPositive
      : '';

  const handleQuantityChange = (val) => {
    setQuantity(val);
    setSubmitError('');
    if (!quantityTouched) setQuantityTouched(true);
  };

  const handleNoteChange = (val) => {
    setNote(val);
    setSubmitError('');
  };

  // Find currently selected asset object
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [selectedAssetId, assets]);

  // Filtered assets for modal picker
  const filteredAssets = useMemo(() => {
    const q = assetSearchQuery.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const nameMatch = (a.name || '').toLowerCase().includes(q);
      const typeMatch = (a.type || '').toLowerCase().includes(q);
      const labelMatch = typeLabel(a.type).toLowerCase().includes(q);
      return nameMatch || typeMatch || labelMatch;
    });
  }, [assets, assetSearchQuery]);

  // Submit transaction
  const handleSubmit = async () => {
    if (submitting) return;

    if (isStockIn && !isAdmin) {
      Alert.alert(strings.adminAccessRequired, strings.adminAccessRequiredStockIn, [
        { text: strings.ok },
      ]);
      return;
    }

    setQuantityTouched(true);
    if (!isQuantityValid) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      if (isStockIn) {
        // Stock IN: POST /api/inventory/:id/in
        await apiClient.post(`/inventory/${itemId}/in`, {
          quantity: numQuantity,
          note: note.trim() || undefined,
        });
      } else {
        // Stock OUT: POST /api/inventory/:id/out
        await apiClient.post(`/inventory/${itemId}/out`, {
          quantity: numQuantity,
          note: note.trim() || undefined,
          assetId: selectedAssetId || null,
        });
      }

      // Success: return to previous screen so useFocusEffect refetches data
      navigation.goBack();
    } catch (err) {
      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }

      // Extract exact backend error message
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        getErrorMessage(err);

      // Display prominently in inline error banner AND native Alert
      setSubmitError(errorMsg);

      Alert.alert(strings.transactionFailedTitle, errorMsg, [
        { text: strings.ok },
      ]);
      // Note: typed inputs (quantity, note, asset) are intentionally NOT cleared!
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Prominent Available Stock Banner */}
        <View style={styles.availableBanner}>
          <View style={styles.bannerIconWrapper}>
            <Ionicons
              name={isStockIn ? 'arrow-down-circle' : 'cube'}
              size={24}
              color={isStockIn ? tones.success.fg : colors.primary}
            />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerItemName}>{itemName}</Text>
            <Text style={styles.bannerStockText}>
              Currently available:{' '}
              <Text style={styles.bannerStockBold}>
                {availableQuantity} {unit}
              </Text>
            </Text>
          </View>
        </View>

        {/* Quantity Input Field with Adjacent Unit Label */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            {strings.quantityLabelRequired}{' '}
            <Text style={styles.requiredAsterisk}>*</Text>
          </Text>

          <View
            style={[
              styles.quantityInputWrapper,
              quantityError ? styles.inputError : null,
            ]}
          >
            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={handleQuantityChange}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              editable={!submitting}
              accessibilityLabel={`Quantity in ${unit}`}
            />
            {unit ? (
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>{unit}</Text>
              </View>
            ) : null}
          </View>

          {quantityError ? (
            <Text style={styles.errorText}>{quantityError}</Text>
          ) : null}
        </View>

        {/* "Used at" Asset Dropdown (Stock OUT only) */}
        {!isStockIn ? (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{strings.usedAtAssetLabel}</Text>

            <TouchableOpacity
              style={styles.selectorInput}
              onPress={() => setAssetModalVisible(true)}
              disabled={submitting || loadingAssets}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={strings.usedAtAssetLabel}
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
                          {selectedAsset.name} •{' '}
                          {typeLabel(selectedAsset.type)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.selectorPlaceholderText}>
                        {strings.noneGeneralUse}
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

        {/* Note Field */}
        <FormField
          label={strings.noteOptional}
          value={note}
          onChangeText={handleNoteChange}
          placeholder={
            isStockIn
              ? strings.notePlaceholderStockIn
              : strings.notePlaceholderStockOut
          }
          multiline={true}
          numberOfLines={3}
          editable={!submitting}
        />

        {/* Prominent Red Error Banner right above submit button */}
        {submitError ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle"
              size={20}
              color={tones.danger.fg}
              style={styles.errorBannerIcon}
            />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <PrimaryButton
            title={isStockIn ? strings.recordStockIn : strings.recordStockOut}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!isQuantityValid || submitting}
            variant="primary"
          />
        </View>
      </ScrollView>

      {/* Asset Search & Select Modal (Stock OUT only) */}
      {!isStockIn ? (
        <Modal
          visible={assetModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAssetModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{strings.usedAtAssetLabel}</Text>
              <TouchableOpacity
                onPress={() => setAssetModalVisible(false)}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Asset Search Input */}
            <View style={styles.modalSearchWrapper}>
              <View style={styles.modalSearchContainer}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={colors.muted}
                  style={{ marginRight: spacing.xs + 2 }}
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

            {/* Assets List */}
            <FlatList
              data={filteredAssets}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[
                    styles.assetItemRow,
                    selectedAssetId === null && styles.assetItemRowSelected,
                  ]}
                  onPress={() => {
                    setSelectedAssetId(null);
                    setAssetModalVisible(false);
                  }}
                >
                  <View style={styles.assetItemContent}>
                    <Text
                      style={[
                        styles.assetItemName,
                        selectedAssetId === null &&
                          styles.assetItemNameSelected,
                      ]}
                    >
                      {strings.noneGeneralUse}
                    </Text>
                    <Text style={styles.assetItemSubtitle}>
                      Not tied to a specific infrastructure asset
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
                      styles.assetItemRow,
                      isSelected && styles.assetItemRowSelected,
                    ]}
                    onPress={() => {
                      setSelectedAssetId(item.id);
                      setAssetModalVisible(false);
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
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </Modal>
      ) : null}
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
  availableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bannerIconWrapper: {
    marginRight: spacing.md,
  },
  bannerContent: {
    flex: 1,
  },
  bannerItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  bannerStockText: {
    fontSize: 14,
    color: colors.muted,
  },
  bannerStockBold: {
    fontWeight: '700',
    color: colors.text,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  requiredAsterisk: {
    color: colors.danger,
  },
  quantityInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  quantityInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  unitBadge: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  unitBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  selectorInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  selectorValueContainer: {
    flex: 1,
  },
  selectedAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  selectorPlaceholderText: {
    fontSize: 15,
    color: colors.muted,
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
  errorBannerIcon: {
    marginRight: spacing.sm,
  },
  errorBannerText: {
    color: tones.danger.fg,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  submitContainer: {
    marginTop: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalSearchWrapper: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
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
  assetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  assetItemRowSelected: {
    borderColor: colors.primary,
    backgroundColor: tones.info.bg,
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
    fontSize: 13,
    color: colors.muted,
  },
});
