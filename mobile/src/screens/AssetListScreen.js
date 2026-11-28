/**
 * AssetListScreen.js
 * Screen displaying the list of water supply assets with search, type and status
 * filter chips, result count, pull-to-refresh, pagination, and empty/error handling.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import ChipSelector from '../components/ChipSelector';
import ListCard from '../components/ListCard';
import EmptyState from '../components/EmptyState';
import SearchBar from '../components/SearchBar';
import {
  ASSET_TYPES,
  ASSET_STATUSES,
  statusTone,
  typeIcon,
  typeLabel,
  statusLabel,
  attributeSummary,
  formatAssetCount,
} from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, spacing } from '../theme';

const PAGE_LIMIT = 50;

export default function AssetListScreen({ navigation, route }) {
  const initialStatusParam = route?.params?.initialStatus || route?.params?.status || null;

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(initialStatusParam);

  // Sync if route params change
  useEffect(() => {
    const s = route?.params?.initialStatus || route?.params?.status;
    if (s) {
      setSelectedStatus(s);
    }
  }, [route?.params?.initialStatus, route?.params?.status]);

  // Assets data & pagination state
  const [assets, setAssets] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Loading & error states
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState('');
  const [reloadError, setReloadError] = useState('');

  // Refs for request tracking and loaded state
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

  // Debounce search query by 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Main data fetching function
  const fetchAssets = useCallback(
    async ({ isRefresh = false } = {}) => {
      const currentReqId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setInitialLoading(true);
      }
      setReloadError('');

      try {
        const params = {
          page: 1,
          limit: PAGE_LIMIT,
        };
        if (selectedType) {
          params.type = selectedType;
        }
        if (selectedStatus) {
          params.status = selectedStatus;
        }
        const trimmed = debouncedSearch.trim();
        if (trimmed) {
          params.search = trimmed;
        }

        const response = await apiClient.get('/assets', { params });

        // Discard response if a newer request was dispatched
        if (currentReqId !== requestIdRef.current) return;

        const data = response.data || {};
        const items = data.assets || [];
        setAssets(items);
        setTotal(data.total || 0);
        setPage(1);
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
    [selectedType, selectedStatus, debouncedSearch]
  );

  // Fetch when screen gains focus or when filters change (ONE effect, no mount double-fetch)
  useFocusEffect(
    useCallback(() => {
      fetchAssets();
    }, [fetchAssets])
  );

  // Pull-to-refresh
  const handleRefresh = () => {
    fetchAssets({ isRefresh: true });
  };

  // Load more pages
  const handleLoadMore = async () => {
    if (loadingMore || refreshing || initialLoading) return;
    if (assets && assets.length >= total) return;

    const nextPage = page + 1;
    setLoadingMore(true);

    try {
      const params = {
        page: nextPage,
        limit: PAGE_LIMIT,
      };
      if (selectedType) {
        params.type = selectedType;
      }
      if (selectedStatus) {
        params.status = selectedStatus;
      }
      const trimmed = debouncedSearch.trim();
      if (trimmed) {
        params.search = trimmed;
      }

      const response = await apiClient.get('/assets', { params });
      const newItems = response.data?.assets || [];

      setAssets((prev) => {
        const existingIds = new Set((prev || []).map((a) => a.id));
        const nonDuplicate = newItems.filter((a) => !existingIds.has(a.id));
        return [...(prev || []), ...nonDuplicate];
      });
      setPage(nextPage);
      setTotal(response.data?.total ?? total);
    } catch (err) {
      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }
      setReloadError(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  // Reset all filters and search
  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedType(null);
    setSelectedStatus(null);
  };

  const hasActiveFilters = Boolean(
    selectedType || selectedStatus || searchQuery.trim()
  );

  // Empty or error state rendered in FlatList
  const renderEmptyComponent = () => {
    if (initialLoading) return null;

    if (initialError) {
      return (
        <EmptyState
          message={initialError}
          actionLabel={strings.retry}
          onAction={() => fetchAssets()}
          icon="alert-circle-outline"
        />
      );
    }

    if (hasActiveFilters) {
      return (
        <EmptyState
          message={strings.noAssetsMatch}
          actionLabel={strings.clearFilters}
          onAction={handleClearFilters}
          icon="search-outline"
        />
      );
    }

    return (
      <EmptyState
        message={strings.noAssetsYet}
        actionLabel={strings.addAsset}
        onAction={() => navigation.navigate('AssetForm')}
        icon="cube-outline"
      />
    );
  };

  // List footer: load more button
  const renderFooter = () => {
    if (!assets || assets.length === 0 || assets.length >= total) {
      return null;
    }

    return (
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={handleLoadMore}
          disabled={loadingMore}
          accessibilityRole="button"
          accessibilityLabel={strings.loadMore}
        >
          {loadingMore ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.loadMoreText}>{strings.loadMore}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // First load full spinner
  if (initialLoading && !hasDataRef.current && !initialError) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top filters outside FlatList so TextInput never loses focus */}
      <View style={styles.topSection}>
        {/* Search input with icon and clear button */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={strings.searchAssetsPlaceholder}
          containerStyle={{ marginBottom: spacing.sm }}
        />

        {/* Type filter chips */}
        <View style={styles.chipsWrapper}>
          <ChipSelector
            options={ASSET_TYPES}
            value={selectedType}
            onChange={setSelectedType}
            scrollable={true}
            allowDeselect={true}
          />
        </View>

        {/* Status filter chips */}
        <View style={styles.chipsWrapper}>
          <ChipSelector
            options={ASSET_STATUSES}
            value={selectedStatus}
            onChange={setSelectedStatus}
            scrollable={true}
            allowDeselect={true}
          />
        </View>

        {/* Result count line */}
        {assets !== null && !initialError ? (
          <Text style={styles.resultCountText}>{formatAssetCount(total)}</Text>
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

      {/* Assets FlatList */}
      <FlatList
        data={assets || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard
            title={item.name}
            subtitle={typeLabel(item.type)}
            meta={attributeSummary(item) || undefined}
            badge={{
              label: statusLabel(item.status),
              tone: statusTone(item.status),
            }}
            icon={typeIcon(item.type)}
            onPress={() =>
              navigation.navigate('AssetDetail', {
                id: item.id,
                name: item.name,
              })
            }
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          assets && assets.length === 0 ? styles.emptyListContent : null,
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmptyComponent}
        ListFooterComponent={renderFooter}
        keyboardShouldPersistTaps="handled"
      />
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  chipsWrapper: {
    marginTop: spacing.xs,
  },
  resultCountText: {
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  reloadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  reloadErrorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    marginRight: spacing.sm,
  },
  dismissErrorButton: {
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footerContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  loadMoreButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
