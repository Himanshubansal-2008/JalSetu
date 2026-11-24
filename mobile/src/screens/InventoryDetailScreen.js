/**
 * InventoryDetailScreen.js
 * Screen displaying full inventory item details, stock summary, role-based
 * Stock IN / OUT action buttons, newest-first transaction history feed,
 * and admin edit trigger in header.
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { formatDateTime } from '../utils/dateUtil';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

export default function InventoryDetailScreen({ route, navigation }) {
  const { itemId: paramItemId, id: paramId, name: initialName } =
    route?.params || {};
  const itemId = paramItemId || paramId || route?.params?.item?.id;

  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Data & loading states
  const [item, setItem] = useState(route?.params?.item || null);
  const [initialLoading, setInitialLoading] = useState(!route?.params?.item);
  const [refreshing, setRefreshing] = useState(false);
  const [initialError, setInitialError] = useState('');
  const [reloadError, setReloadError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Tracking refs
  const hasDataRef = useRef(Boolean(route?.params?.item));
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  // Component mount lifecycle tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Header configuration: Title & Admin-only Edit button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: item?.name || initialName || strings.inventoryDetailTitle,
      headerRight:
        isAdmin && item
          ? () => (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('InventoryForm', {
                    itemId: item.id,
                    id: item.id,
                    item,
                    mode: 'edit',
                  })
                }
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel={strings.edit}
              >
                <Text style={styles.headerButtonText}>{strings.edit}</Text>
              </TouchableOpacity>
            )
          : null,
    });
  }, [navigation, isAdmin, item, initialName]);

  // Fetch inventory item with full stock transactions
  const fetchItem = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!itemId) return;

      const currentReqId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setInitialLoading(true);
      }
      setReloadError('');

      try {
        const response = await apiClient.get(`/inventory/${itemId}`);
        if (!isMountedRef.current || currentReqId !== requestIdRef.current) {
          return;
        }

        const data = response.data?.item;
        if (!data) {
          setNotFound(true);
          return;
        }

        setItem(data);
        hasDataRef.current = true;
        setNotFound(false);
        setInitialError('');
      } catch (err) {
        if (!isMountedRef.current || currentReqId !== requestIdRef.current) {
          return;
        }

        if (err?.response?.status === 401) {
          useAuthStore.getState().logout();
          return;
        }
        if (err?.response?.status === 404) {
          setNotFound(true);
          return;
        }

        const msg = getErrorMessage(err);
        if (!hasDataRef.current) {
          setInitialError(msg);
        } else {
          setReloadError(msg);
        }
      } finally {
        if (isMountedRef.current && currentReqId === requestIdRef.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [itemId]
  );

  // Refetch when screen comes into focus (e.g. after Edit or Stock IN/OUT)
  useFocusEffect(
    useCallback(() => {
      fetchItem();
    }, [fetchItem])
  );

  const handleRefresh = () => {
    fetchItem({ isRefresh: true });
  };

  // 1. Initial loading full-screen spinner
  if (initialLoading && !hasDataRef.current && !initialError && !notFound) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 2. Not found error state
  if (notFound) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message="Inventory item not found."
          actionLabel="Go Back"
          onAction={() => navigation.goBack()}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  // 3. Initial fetch error state
  if (initialError && !hasDataRef.current) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message={initialError}
          actionLabel={strings.retry}
          onAction={() => fetchItem()}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  const transactions = item?.transactions || item?.txns || [];
  const isLowStock =
    Boolean(item?.isLowStock) ||
    (item && item.quantity <= item.reorderLevel);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Dismissible reload error banner */}
      {reloadError ? (
        <View style={styles.reloadErrorBanner}>
          <Text style={styles.reloadErrorText} numberOfLines={2}>
            {reloadError}
          </Text>
          <TouchableOpacity
            onPress={() => setReloadError('')}
            accessibilityRole="button"
            accessibilityLabel={strings.dismiss}
            style={styles.dismissErrorButton}
          >
            <Ionicons name="close" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Stock Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCardHeader}>
          <Text style={styles.summaryCardLabel}>{strings.currentStock}</Text>
          {isLowStock ? (
            <StatusBadge label={strings.lowStockBadge} tone="danger" />
          ) : null}
        </View>

        <Text style={styles.stockValue}>
          {item?.quantity ?? 0} {item?.unit || ''}
        </Text>

        <View style={styles.reorderRow}>
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={colors.muted}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.reorderText}>
            Reorder at {item?.reorderLevel ?? 0} {item?.unit || ''}
          </Text>
        </View>

        {isLowStock ? (
          <View style={styles.lowStockCallout}>
            <Ionicons
              name="warning"
              size={18}
              color={tones.warning.fg}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.lowStockCalloutText}>
              Stock is at or below the reorder level ({item?.reorderLevel}{' '}
              {item?.unit || ''}).
            </Text>
          </View>
        ) : null}
      </View>

      {/* Role-Based Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Use Stock (Stock OUT) Button - Accessible to all roles */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isAdmin ? styles.actionButtonSplit : styles.actionButtonFull,
            styles.useStockButton,
          ]}
          onPress={() =>
            navigation.navigate('StockOut', {
              itemId: item.id,
              item,
              name: item.name,
              unit: item.unit,
              currentQuantity: item.quantity,
            })
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={strings.useStock}
        >
          <Ionicons
            name="arrow-up-circle-outline"
            size={20}
            color={colors.white}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.actionButtonText}>{strings.useStock}</Text>
        </TouchableOpacity>

        {/* Add Stock (Stock IN) Button - Admin only */}
        {isAdmin ? (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonSplit,
              styles.addStockButton,
            ]}
            onPress={() =>
              navigation.navigate('StockIn', {
                itemId: item.id,
                item,
                name: item.name,
                unit: item.unit,
                currentQuantity: item.quantity,
              })
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={strings.addStock}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={20}
              color={colors.white}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.actionButtonText}>{strings.addStock}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Transaction History Section */}
      <View style={styles.historySection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {strings.stockHistory}
            {transactions.length > 0 ? ` (${transactions.length})` : ''}
          </Text>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyHistoryCard}>
            <Ionicons
              name="file-tray-outline"
              size={36}
              color={colors.muted}
              style={{ marginBottom: spacing.xs }}
            />
            <Text style={styles.emptyHistoryText}>
              {strings.noStockHistoryYet}
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {transactions.map((txn) => {
              const isStockIn = txn.type === 'IN';
              const userName =
                txn.user?.name || txn.createdBy?.name || strings.unknownUser;
              const formattedDate = formatDateTime(txn.createdAt);

              return (
                <View key={txn.id} style={styles.txnCard}>
                  {/* Top row: Type badge, quantity, and timestamp */}
                  <View style={styles.txnHeaderRow}>
                    <View style={styles.txnTypeGroup}>
                      <View
                        style={[
                          styles.directionBadge,
                          isStockIn
                            ? styles.directionBadgeIn
                            : styles.directionBadgeOut,
                        ]}
                      >
                        <Text
                          style={[
                            styles.directionBadgeText,
                            isStockIn
                              ? styles.directionBadgeTextIn
                              : styles.directionBadgeTextOut,
                          ]}
                        >
                          {isStockIn ? '+' : '-'} {txn.quantity}{' '}
                          {item?.unit || ''}
                        </Text>
                      </View>
                      <Text style={styles.txnTypeLabel}>
                        {isStockIn ? 'Stock IN' : 'Stock OUT'}
                      </Text>
                    </View>

                    <Text style={styles.txnDateText}>{formattedDate}</Text>
                  </View>

                  {/* Optional Linked Asset */}
                  {txn.asset ? (
                    <View style={styles.assetLinkedRow}>
                      <Ionicons
                        name="cube-outline"
                        size={15}
                        color={colors.primary}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={styles.assetLinkedText}>
                        Used at: {txn.asset.name}
                        {txn.asset.type ? ` (${txn.asset.type})` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {/* Optional Note */}
                  {txn.note ? (
                    <Text style={styles.txnNoteText}>"{txn.note}"</Text>
                  ) : null}

                  {/* Footer: User / Actor */}
                  <View style={styles.txnFooterRow}>
                    <Ionicons
                      name="person-outline"
                      size={13}
                      color={colors.muted}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.txnUserText}>by {userName}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
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
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  headerButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  reloadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tones.danger.bg,
    borderWidth: 1,
    borderColor: tones.danger.fg,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  reloadErrorText: {
    color: tones.danger.fg,
    fontSize: 12,
    flex: 1,
    marginRight: spacing.xs,
  },
  dismissErrorButton: {
    padding: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  summaryCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stockValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginVertical: spacing.xs,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  reorderText: {
    fontSize: 14,
    color: colors.muted,
  },
  lowStockCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.warning.bg,
    borderWidth: 1,
    borderColor: tones.warning.fg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  lowStockCalloutText: {
    fontSize: 12,
    fontWeight: '600',
    color: tones.warning.fg,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButtonFull: {
    flex: 1,
  },
  actionButtonSplit: {
    flex: 1,
  },
  useStockButton: {
    backgroundColor: '#D97706', // Warm amber / orange for stock consumption
  },
  addStockButton: {
    backgroundColor: tones.success.fg, // Forest green for stock replenishing
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  historySection: {
    marginTop: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyHistoryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  historyList: {
    gap: spacing.sm + 2,
  },
  txnCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  txnHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  txnTypeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  directionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginRight: spacing.xs + 2,
  },
  directionBadgeIn: {
    backgroundColor: tones.success.bg,
  },
  directionBadgeOut: {
    backgroundColor: tones.danger.bg,
  },
  directionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  directionBadgeTextIn: {
    color: tones.success.fg,
  },
  directionBadgeTextOut: {
    color: tones.danger.fg,
  },
  txnTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  txnDateText: {
    fontSize: 12,
    color: colors.muted,
  },
  assetLinkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  assetLinkedText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  txnNoteText: {
    fontSize: 13,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  txnFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  txnUserText: {
    fontSize: 11,
    color: colors.muted,
  },
});
