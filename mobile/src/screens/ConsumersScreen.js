/**
 * ConsumersScreen.js
 * Admin-only Consumers list screen in the JalKosh mobile app.
 *
 * Features:
 * - Admin route guard protecting /api/consumers
 * - Live search filtering by consumer name or house number with clear × button
 * - Quick jump button to Monthly Bills screen
 * - Pull-to-refresh and useFocusEffect re-fetching
 * - Card displaying Name, House Number, Phone, Monthly Tariff, Pending Dues / No Dues pill, Inactive badge
 * - Tapping navigates to Consumer Detail; + Add button navigates to ConsumerFormScreen
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { formatPaiseToRupees } from '../utils/currency';
import EmptyState from '../components/EmptyState';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

export default function ConsumersScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Data state
  const [consumers, setConsumers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const hasDataRef = useRef(false);
  const requestIdRef = useRef(0);

  // Fetch consumers from backend
  const fetchConsumers = useCallback(
    async ({ isRefresh = false, search = searchQuery } = {}) => {
      if (!isAdmin) return;

      const currentReqId = ++requestIdRef.current;
      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setInitialLoading(true);
      }
      setError('');

      try {
        const params = {};
        if (search && search.trim()) {
          params.search = search.trim();
        }

        const response = await apiClient.get('/consumers', { params });
        if (currentReqId !== requestIdRef.current) return;

        const data = response.data?.consumers || [];
        setConsumers(data);
        hasDataRef.current = true;
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        setError(getErrorMessage(err));
      } finally {
        if (currentReqId === requestIdRef.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [isAdmin, searchQuery]
  );

  // Re-fetch on focus
  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        fetchConsumers();
      }
    }, [isAdmin, fetchConsumers])
  );

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    fetchConsumers({ isRefresh: true });
  }, [fetchConsumers]);

  // Search input change handler
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    fetchConsumers({ search: text });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchConsumers({ search: '' });
  };

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

  // Render Consumer Card
  const renderConsumerCard = ({ item }) => {
    const isInactive = !item.isActive;
    const hasDues = (item.pendingDuesPaise || 0) > 0;

    return (
      <TouchableOpacity
        style={[styles.card, isInactive && styles.cardInactive]}
        onPress={() =>
          navigation.navigate('ConsumerDetail', {
            consumer: item,
            id: item.id,
          })
        }
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, House ${item.houseNumber}`}
      >
        {/* Top Row: Name, House Badge, and Inactive Status */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.nameAndHouseContainer}>
            <Text style={styles.consumerName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.houseBadge}>
              <Text style={styles.houseBadgeText}>{item.houseNumber}</Text>
            </View>
          </View>

          {isInactive ? (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>
                {strings.inactiveStatus}
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          )}
        </View>

        {/* Middle Row: Phone number */}
        {item.phone ? (
          <View style={styles.phoneRow}>
            <Ionicons
              name="call-outline"
              size={13}
              color={colors.muted}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.phoneText}>{item.phone}</Text>
          </View>
        ) : null}

        {/* Bottom Row: Monthly Tariff & Dues Indicator */}
        <View style={styles.cardFooterRow}>
          <View style={styles.tariffContainer}>
            <Text style={styles.tariffAmount}>
              {formatPaiseToRupees(item.monthlyChargePaise)}
              <Text style={styles.tariffSuffix}>{strings.monthlyRateSuffix}</Text>
            </Text>
          </View>

          {hasDues ? (
            <View style={styles.dueBadge}>
              <Text style={styles.dueBadgeText}>
                {strings.duePrefix}
                {formatPaiseToRupees(item.pendingDuesPaise)}
              </Text>
            </View>
          ) : (
            <View style={styles.noDuesBadge}>
              <Text style={styles.noDuesBadgeText}>{strings.noDues}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar & Quick Action Row */}
      <View style={styles.topControlSection}>
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={strings.searchConsumersPlaceholder}
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearSearchButton}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick Jump to Bills & Add Consumer Action Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={styles.billsJumpButton}
            onPress={() => navigation.navigate('BillsList')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={strings.viewBills}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color={colors.primary}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.billsJumpButtonText}>{strings.viewBills}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addConsumerButton}
            onPress={() => navigation.navigate('ConsumerForm')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={strings.addConsumer}
          >
            <Ionicons
              name="add"
              size={18}
              color={colors.white}
              style={{ marginRight: 2 }}
            />
            <Text style={styles.addConsumerButtonText}>
              {strings.addConsumer}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Message Banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.danger}
            style={{ marginRight: spacing.xs }}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Loading Indicator */}
      {initialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={consumers}
          keyExtractor={(item) => item.id}
          renderItem={renderConsumerCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={
                searchQuery
                  ? strings.noConsumersMatchSearch
                  : strings.noConsumersFound
              }
              actionLabel={searchQuery ? undefined : strings.addConsumer}
              onAction={
                searchQuery
                  ? undefined
                  : () => navigation.navigate('ConsumerForm')
              }
            />
          }
        />
      )}
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
    justifyContent: 'center',
    alignItems: 'center',
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
  topControlSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  billsJumpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.info.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  billsJumpButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  addConsumerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.sm + 2,
  },
  addConsumerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: tones.danger.fg,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardInactive: {
    opacity: 0.65,
    backgroundColor: '#F8FAFC',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameAndHouseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.xs,
  },
  consumerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.xs,
  },
  houseBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  houseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  inactiveBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  phoneText: {
    fontSize: 13,
    color: colors.muted,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tariffContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tariffAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  tariffSuffix: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.muted,
  },
  dueBadge: {
    backgroundColor: tones.danger.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: tones.danger.fg,
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  noDuesBadge: {
    backgroundColor: tones.success.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  noDuesBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tones.success.fg,
  },
});
