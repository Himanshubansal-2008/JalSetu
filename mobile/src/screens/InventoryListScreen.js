/**
 * InventoryListScreen.js
 * Screen displaying the list of inventory items with search, low-stock filter toggle,
 * low-stock alert banner, pull-to-refresh, empty/error handling, and admin-only add item action.
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import ListCard from '../components/ListCard';
import EmptyState from '../components/EmptyState';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

export default function InventoryListScreen({ navigation, route }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(Boolean(route?.params?.lowStockOnly));

  // Sync if route params change
  useEffect(() => {
    if (route?.params?.lowStockOnly !== undefined) {
      setLowStockOnly(Boolean(route.params.lowStockOnly));
    }
  }, [route?.params?.lowStockOnly]);

  // Inventory data state
  const [items, setItems] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [total, setTotal] = useState(0);

  // Loading & error states
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialError, setInitialError] = useState('');
  const [reloadError, setReloadError] = useState('');

  // Refs for tracking async requests
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

  // Debounce search query by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Admin-only header + Add item button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: strings.inventoryTitle,
      headerRight: isAdmin
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('InventoryForm', { mode: 'create' })
              }
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={strings.addItem}
            >
              <Text style={styles.headerButtonText}>{strings.addItem}</Text>
            </TouchableOpacity>
          )
        : null,
    });
  }, [navigation, isAdmin]);

  // Main data fetch function
  const fetchInventory = useCallback(
    async ({ isRefresh = false } = {}) => {
      const currentReqId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setInitialLoading(true);
      }
      setReloadError('');

      try {
        const params = {};
        const trimmed = debouncedSearch.trim();
        if (trimmed) {
          params.search = trimmed;
        }
        if (lowStockOnly) {
          params.lowStockOnly = true;
        }

        const response = await apiClient.get('/inventory', { params });
        if (currentReqId !== requestIdRef.current) return;

        const data = response.data || {};
        const fetchedItems = data.items || [];
        setItems(fetchedItems);
        setLowStockCount(data.lowStockCount ?? 0);
        setTotal(data.total ?? fetchedItems.length);
        setInitialError('');
        hasDataRef.current = true;
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;

        if (err?.response?.status === 401) {
          useAuthStore.getState().logout();
          return;
        }

        const msg = getErrorMessage(err);
        if (!hasDataRef.current) {
          setInitialError(msg);
        } else {
          setReloadError(msg);
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [debouncedSearch, lowStockOnly]
  );

  // Automatically refresh when screen gains focus or filters change
  useFocusEffect(
    useCallback(() => {
      fetchInventory();
    }, [fetchInventory])
  );

  // Pull-to-refresh handler
  const handleRefresh = () => {
    fetchInventory({ isRefresh: true });
  };

  // Reset filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setLowStockOnly(false);
  };

  const hasActiveFilters = Boolean(searchQuery.trim() || lowStockOnly);

  // Render empty or error state
  const renderEmptyComponent = () => {
    if (initialLoading) return null;

    if (initialError) {
      return (
        <EmptyState
          message={initialError}
          actionLabel={strings.retry}
          onAction={() => fetchInventory()}
          icon="alert-circle-outline"
        />
      );
    }

    if (hasActiveFilters) {
      return (
        <EmptyState
          message={strings.noInventoryMatch}
          actionLabel={strings.clearFilters}
          onAction={handleClearFilters}
          icon="search-outline"
        />
      );
    }

    return (
      <EmptyState
        message={strings.noInventoryYet}
        actionLabel={isAdmin ? strings.addItem : undefined}
        onAction={
          isAdmin
            ? () => navigation.navigate('InventoryForm', { mode: 'create' })
            : undefined
        }
        icon="file-tray-stacked-outline"
      />
    );
  };

  // Full-screen spinner for very first load
  if (initialLoading && !hasDataRef.current && !initialError) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Section: Low-stock banner, search bar, and filter controls */}
      <View style={styles.topSection}>
        {/* Prominent Low-Stock Alert Banner */}
        {lowStockCount > 0 ? (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => setLowStockOnly((prev) => !prev)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              lowStockCount === 1
                ? strings.lowStockBannerSingular
                : strings.lowStockBannerPlural.replace(
                    '{count}',
                    String(lowStockCount)
                  )
            }
          >
            <View style={styles.alertBannerContent}>
              <Ionicons
                name="warning"
                size={20}
                color={tones.warning.fg}
                style={styles.alertBannerIcon}
              />
              <Text style={styles.alertBannerText}>
                {lowStockCount === 1
                  ? strings.lowStockBannerSingular
                  : strings.lowStockBannerPlural.replace(
                      '{count}',
                      String(lowStockCount)
                    )}
              </Text>
            </View>
            <View style={styles.alertBannerAction}>
              <Text style={styles.alertBannerActionText}>
                {lowStockOnly ? 'Show all' : 'View'}
              </Text>
              <Ionicons
                name={lowStockOnly ? 'close-circle-outline' : 'chevron-forward'}
                size={16}
                color={tones.warning.fg}
              />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Search input with clear button */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={strings.searchInventoryPlaceholder}
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={strings.searchInventoryPlaceholder}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
              accessibilityRole="button"
              accessibilityLabel={strings.clearSearch}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter row: Low-stock toggle chip */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              lowStockOnly
                ? styles.filterChipActive
                : styles.filterChipInactive,
            ]}
            onPress={() => setLowStockOnly((prev) => !prev)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={strings.lowStockOnly}
            accessibilityState={{ selected: lowStockOnly }}
          >
            <Ionicons
              name={lowStockOnly ? 'alert-circle' : 'alert-circle-outline'}
              size={18}
              color={lowStockOnly ? colors.white : tones.danger.fg}
              style={styles.filterChipIcon}
            />
            <Text
              style={[
                styles.filterChipText,
                lowStockOnly
                  ? styles.filterChipTextActive
                  : styles.filterChipTextInactive,
              ]}
            >
              {strings.lowStockOnly}
            </Text>
            {lowStockCount > 0 ? (
              <View
                style={[
                  styles.countBadge,
                  lowStockOnly
                    ? styles.countBadgeActive
                    : styles.countBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    lowStockOnly
                      ? styles.countBadgeTextActive
                      : styles.countBadgeTextInactive,
                  ]}
                >
                  {lowStockCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Results summary line */}
        {items !== null && !initialError ? (
          <Text style={styles.resultCountText}>
            {total === 1
              ? strings.itemCountSingular
              : strings.itemCountPlural.replace('{count}', String(total))}
          </Text>
        ) : null}

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
      </View>

      {/* Inventory Items FlatList */}
      <FlatList
        data={items || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard
            title={item.name}
            subtitle={`${item.quantity} ${item.unit}`}
            meta={`Reorder at ${item.reorderLevel} ${item.unit}`}
            badge={
              item.isLowStock
                ? { label: strings.lowStockBadge, tone: 'danger' }
                : null
            }
            icon="cube-outline"
            onPress={() =>
              navigation.navigate('InventoryDetail', {
                itemId: item.id,
                id: item.id,
                name: item.name,
              })
            }
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          items && items.length === 0 ? styles.emptyListContent : null,
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmptyComponent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Admin-only Floating Action Button */}
      {isAdmin ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            navigation.navigate('InventoryForm', { mode: 'create' })
          }
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={strings.addItem}
        >
          <Ionicons name="add" size={24} color={colors.white} />
          <Text style={styles.fabText}>Add item</Text>
        </TouchableOpacity>
      ) : null}
    </View>
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
  },
  topSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  alertBanner: {
    backgroundColor: tones.warning.bg,
    borderWidth: 1,
    borderColor: tones.warning.fg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  alertBannerIcon: {
    marginRight: spacing.sm,
  },
  alertBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: tones.warning.fg,
    flex: 1,
  },
  alertBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertBannerActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: tones.warning.fg,
    marginRight: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm + 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipInactive: {
    backgroundColor: tones.danger.bg,
    borderColor: '#FECACA',
  },
  filterChipActive: {
    backgroundColor: tones.danger.fg,
    borderColor: tones.danger.fg,
  },
  filterChipIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextInactive: {
    color: tones.danger.fg,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  countBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  countBadgeInactive: {
    backgroundColor: tones.danger.fg,
  },
  countBadgeActive: {
    backgroundColor: colors.white,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countBadgeTextInactive: {
    color: colors.white,
  },
  countBadgeTextActive: {
    color: tones.danger.fg,
  },
  resultCountText: {
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.sm,
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
    marginTop: spacing.sm,
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
  listContent: {
    padding: spacing.lg,
    paddingBottom: 88, // extra room for FAB and bottom tabs
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: spacing.xs + 2,
  },
});
