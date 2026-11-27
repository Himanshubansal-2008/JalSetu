/**
 * LedgerEntryDetailScreen.js
 * Screen displaying the full details of a ledger entry (Receipt or Expense).
 * Features:
 * - Prominent formatted rupee amount card (green for receipts, red for expenses)
 * - Metadata rows: Date, Category, Payment Mode, Running Balance, Reference, Description
 * - Linked Asset clickable row for expenses, navigating to Asset Detail screen
 * - System-Generated lock banner: informational notice and lock if entry.isSystem === true
 * - Admin Edit & Delete buttons (hidden when entry.isSystem is true)
 * - Native Alert confirmation on delete with loading state and error surfacing
 * - Auto-refresh on return from Edit Mode
 */

import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { formatPaiseToRupees } from '../utils/currency';
import { formatDisplay, isoToDateString } from '../utils/dateUtil';
import { typeLabel } from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

export default function LedgerEntryDetailScreen({ route, navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  const initialEntry = route.params?.entry || null;
  const entryId =
    initialEntry?.id || route.params?.id || route.params?.entryId;

  const [entry, setEntry] = useState(initialEntry);
  const [loading, setLoading] = useState(!initialEntry);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isReceipt = entry?.type === 'RECEIPT';

  // Dynamic header title
  useLayoutEffect(() => {
    navigation.setOptions({
      title: entry
        ? isReceipt
          ? strings.receiptDetails
          : strings.expenseDetails
        : strings.ledgerEntryDetail,
    });
  }, [navigation, entry, isReceipt]);

  // Fetch or refresh entry details from /api/finance/entries
  const refreshEntry = useCallback(async () => {
    if (!entryId || !isAdmin) return;

    try {
      setError('');
      const response = await apiClient.get('/finance/entries');
      const allEntries = response.data?.entries || [];
      const found = allEntries.find((e) => e.id === entryId);
      if (found) {
        setEntry(found);
      } else if (!entry) {
        setError('Ledger entry not found');
      }
    } catch (err) {
      if (!entry) {
        setError(getErrorMessage(err, 'Failed to load ledger entry'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entryId, isAdmin, entry]);

  // Initial fetch if entry wasn't passed directly
  useEffect(() => {
    if (!initialEntry && entryId) {
      setLoading(true);
      refreshEntry();
    }
  }, [initialEntry, entryId, refreshEntry]);

  // Re-fetch on focus to catch edits made in FinanceEntryFormScreen
  useFocusEffect(
    useCallback(() => {
      if (entryId) {
        refreshEntry();
      }
    }, [entryId, refreshEntry])
  );

  // Jump to linked Asset Detail screen
  const handleJumpToAsset = () => {
    if (!entry?.asset?.id) return;
    const assetId = entry.asset.id;
    try {
      navigation.navigate(strings.assets, {
        screen: 'AssetDetail',
        params: { id: assetId },
      });
    } catch (err) {
      try {
        navigation.navigate('AssetDetail', { id: assetId });
      } catch (e) {
        // Safe fallback
      }
    }
  };

  // Admin Edit Action
  const handleEdit = () => {
    if (!entry || entry.isSystem || !isAdmin) return;
    navigation.navigate('FinanceEntryForm', {
      entry,
      mode: entry.type,
      initialType: entry.type,
    });
  };

  // Admin Delete Action
  const handleDelete = () => {
    if (!entry || entry.isSystem || !isAdmin) return;

    Alert.alert(
      strings.deleteEntryConfirmTitle,
      strings.deleteEntryConfirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiClient.delete(`/finance/entries/${entry.id}`);
              navigation.goBack();
            } catch (err) {
              setDeleting(false);
              Alert.alert(strings.deleteFailed, getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !entry) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorTitle}>Could not load entry</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            refreshEntry();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>{strings.retry || 'Retry'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
        <Text style={styles.emptyText}>Entry not found</Text>
      </View>
    );
  }

  const amountPaise =
    entry.amountPaise != null ? entry.amountPaise : entry.amount || 0;
  const displayDate = formatDisplay(entry.date) || isoToDateString(entry.date);
  const isSystem = Boolean(entry.isSystem);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refreshEntry();
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* 1. Top Amount & Category Banner Card */}
      <View
        style={[
          styles.amountCard,
          isReceipt ? styles.amountCardReceipt : styles.amountCardExpense,
        ]}
      >
        <View style={styles.typeBadge}>
          <Ionicons
            name={isReceipt ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={16}
            color={isReceipt ? tones.success.fg : tones.danger.fg}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.typeBadgeText,
              { color: isReceipt ? tones.success.fg : tones.danger.fg },
            ]}
          >
            {isReceipt ? strings.receipt : strings.expense}
          </Text>
        </View>

        <Text
          style={[
            styles.amountText,
            { color: isReceipt ? tones.success.fg : tones.danger.fg },
          ]}
        >
          {isReceipt ? '+' : '-'}
          {formatPaiseToRupees(amountPaise)}
        </Text>

        <Text style={styles.categoryTitle}>{entry.category || 'General'}</Text>
      </View>

      {/* 2. System-Generated Lock Banner */}
      {isSystem && (
        <View style={styles.systemLockBanner}>
          <View style={styles.systemLockIconCircle}>
            <Ionicons name="lock-closed" size={18} color={tones.warning.fg} />
          </View>
          <View style={styles.systemLockTextBox}>
            <Text style={styles.systemLockTitle}>{strings.systemEntryBadge}</Text>
            <Text style={styles.systemLockMessage}>
              {strings.systemEntryLockMessage}
            </Text>
          </View>
        </View>
      )}

      {/* 3. Metadata Details Card */}
      <View style={styles.detailsCard}>
        {/* Date */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{strings.dateLabel}</Text>
          <Text style={styles.detailValue}>{displayDate}</Text>
        </View>

        {/* Category */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{strings.categoryLabel}</Text>
          <Text style={styles.detailValue}>{entry.category}</Text>
        </View>

        {/* Payment Mode */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{strings.paymentModeLabel}</Text>
          <View style={styles.modeMiniBadge}>
            <Text style={styles.modeMiniBadgeText}>{entry.mode || 'Cash'}</Text>
          </View>
        </View>

        {/* Running Balance (if present) */}
        {entry.runningBalancePaise != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Running Balance</Text>
            <Text style={[styles.detailValue, { fontWeight: '700' }]}>
              {formatPaiseToRupees(entry.runningBalancePaise)}
            </Text>
          </View>
        )}

        {/* Linked Asset (Expense mode) */}
        {entry.asset && (
          <TouchableOpacity
            style={[styles.detailRow, styles.clickableRow]}
            onPress={handleJumpToAsset}
            activeOpacity={0.7}
          >
            <Text style={styles.detailLabel}>{strings.linkedAssetLabel}</Text>
            <View style={styles.linkedAssetRow}>
              <Ionicons
                name="cube-outline"
                size={16}
                color={colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.linkedAssetText} numberOfLines={1}>
                {entry.asset.name} ({typeLabel(entry.asset.type)})
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.primary}
                style={{ marginLeft: 4 }}
              />
            </View>
          </TouchableOpacity>
        )}

        {/* Reference / UTR */}
        {entry.reference ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{strings.referenceLabel}</Text>
            <Text style={[styles.detailValue, styles.monoText]}>
              {entry.reference}
            </Text>
          </View>
        ) : null}

        {/* Description / Note */}
        {entry.description ? (
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>{strings.descriptionLabel}</Text>
            <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
              {entry.description}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 4. Admin Edit & Delete Actions (Locked when isSystem is true) */}
      {isAdmin && !isSystem && (
        <View style={styles.actionsContainer}>
          {/* Edit Entry */}
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEdit}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <Ionicons
              name="pencil-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.editButtonText}>{strings.editEntry}</Text>
          </TouchableOpacity>

          {/* Delete Entry */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.7}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={colors.danger}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.deleteButtonText}>
                  {strings.deleteEntry}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  emptyText: {
    fontSize: 16,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  amountCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountCardReceipt: {
    backgroundColor: '#F8FCF8',
    borderColor: '#C8E6C9',
  },
  amountCardExpense: {
    backgroundColor: '#FCF8F8',
    borderColor: '#FFCDD2',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  categoryTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  systemLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.warning.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  systemLockIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  systemLockTextBox: {
    flex: 1,
  },
  systemLockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tones.warning.fg,
    marginBottom: 2,
  },
  systemLockMessage: {
    fontSize: 12,
    color: tones.warning.fg,
    lineHeight: 16,
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  clickableRow: {
    backgroundColor: '#FAFBFD',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  modeMiniBadge: {
    backgroundColor: tones.info.bg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeMiniBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  linkedAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: spacing.sm,
  },
  linkedAssetText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  actionsContainer: {
    gap: spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tones.danger.fg,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: tones.danger.fg,
  },
});
