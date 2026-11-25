/**
 * MonthlySummaryScreen.js
 * Category-wise Income and Expense breakdown screen for the JalKosh mobile app.
 * Features:
 * - Month picker header with previous / next month arrows (< / >)
 * - Top Month Totals banner (Total Income, Total Expense, Net Month Balance)
 * - Income by Category section with percentage share, formatted rupee amounts, and horizontal proportion bars
 * - Expense by Category section with percentage share, formatted rupee amounts, and horizontal proportion bars
 * - Pull-to-refresh, useFocusEffect, error handling with retry, and non-admin route guard
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

// Helper: shifts YYYY-MM by delta months
function shiftMonth(monthStr, delta) {
  const [yStr, mStr] = monthStr.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10);

  month += delta;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Formats YYYY-MM to readable string e.g. "December 2026"
function formatMonthName(monthStr) {
  const [yStr, mStr] = monthStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function MonthlySummaryScreen({ route, navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Compute default current month
  const now = new Date();
  const defaultCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState(() => {
    return route.params?.month || defaultCurrentMonth;
  });

  // Data & loading states
  const [summary, setSummary] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

  // Set navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: strings.monthlySummaryTitle,
    });
  }, [navigation]);

  // Main data fetch
  const fetchSummary = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!isAdmin) return;

      const currentReqId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setInitialLoading(true);
      }
      setError('');

      try {
        const response = await apiClient.get('/finance/summary', {
          params: { month: selectedMonth },
        });

        if (currentReqId !== requestIdRef.current) return;

        setSummary(response.data);
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
    [isAdmin, selectedMonth]
  );

  // Re-fetch on month change and screen focus
  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        fetchSummary();
      }
    }, [isAdmin, fetchSummary])
  );

  const handleRefresh = useCallback(() => {
    fetchSummary({ isRefresh: true });
  }, [fetchSummary]);

  // Month navigation arrows
  const handlePrevMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, 1));
  };

  // Route guard for non-admin
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

  // Initial loading spinner
  if (initialLoading && !hasDataRef.current) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const totalIncomePaise = summary?.income?.totalIncomePaise ?? 0;
  const totalExpensePaise = summary?.expense?.totalExpensePaise ?? 0;
  const netBalancePaise =
    summary?.netBalancePaise ?? (totalIncomePaise - totalExpensePaise);
  const incomeCategories = summary?.income?.categories ?? [];
  const expenseCategories = summary?.expense?.categories ?? [];

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
      {/* 1. Month Picker Header */}
      <View style={styles.monthControlsRow}>
        <TouchableOpacity
          style={styles.monthArrowButton}
          onPress={handlePrevMonth}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.monthDisplayBadge}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.monthDisplayText}>
            {formatMonthName(selectedMonth)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.monthArrowButton}
          onPress={handleNextMonth}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Error Card */}
      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchSummary()}
          >
            <Text style={styles.retryButtonText}>{strings.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 2. Top Month Totals Banner */}
      <View style={styles.totalsSection}>
        <View style={styles.totalsCardsRow}>
          {/* Income Card */}
          <View style={[styles.totalCard, styles.incomeCard]}>
            <View style={styles.totalCardHeader}>
              <View
                style={[
                  styles.totalIconCircle,
                  { backgroundColor: tones.success.bg },
                ]}
              >
                <Ionicons
                  name="arrow-down"
                  size={14}
                  color={tones.success.fg}
                />
              </View>
              <Text style={styles.totalCardLabel}>{strings.totalIncome}</Text>
            </View>
            <Text
              style={[styles.totalCardAmount, { color: tones.success.fg }]}
            >
              +{formatPaiseToRupees(totalIncomePaise)}
            </Text>
          </View>

          {/* Expense Card */}
          <View style={[styles.totalCard, styles.expenseCard]}>
            <View style={styles.totalCardHeader}>
              <View
                style={[
                  styles.totalIconCircle,
                  { backgroundColor: tones.danger.bg },
                ]}
              >
                <Ionicons name="arrow-up" size={14} color={tones.danger.fg} />
              </View>
              <Text style={styles.totalCardLabel}>{strings.totalExpense}</Text>
            </View>
            <Text style={[styles.totalCardAmount, { color: tones.danger.fg }]}>
              -{formatPaiseToRupees(totalExpensePaise)}
            </Text>
          </View>
        </View>

        {/* Net Month Balance Card */}
        <View
          style={[
            styles.netBalanceBanner,
            netBalancePaise >= 0
              ? styles.netBalancePositive
              : styles.netBalanceNegative,
          ]}
        >
          <View style={styles.netBalanceLeft}>
            <View
              style={[
                styles.totalIconCircle,
                {
                  backgroundColor:
                    netBalancePaise >= 0
                      ? tones.success.bg
                      : tones.danger.bg,
                },
              ]}
            >
              <Ionicons
                name="wallet-outline"
                size={16}
                color={
                  netBalancePaise >= 0
                    ? tones.success.fg
                    : tones.danger.fg
                }
              />
            </View>
            <Text style={styles.netBalanceTitle}>
              {strings.netMonthBalance}
            </Text>
          </View>

          <Text
            style={[
              styles.netBalanceValue,
              {
                color:
                  netBalancePaise >= 0
                    ? tones.success.fg
                    : tones.danger.fg,
              },
            ]}
          >
            {formatPaiseToRupees(netBalancePaise, { showSign: true })}
          </Text>
        </View>
      </View>

      {/* 3. Income by Category Section */}
      <View style={styles.sectionWrapper}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons
            name="arrow-down-circle"
            size={18}
            color={tones.success.fg}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.sectionHeaderTitle}>
            {strings.incomeByCategory}
          </Text>
          {incomeCategories.length > 0 && (
            <View style={styles.countBadgeGreen}>
              <Text style={styles.countBadgeTextGreen}>
                {incomeCategories.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.categoryCard}>
          {incomeCategories.length === 0 ? (
            <View style={styles.emptyCategoryBox}>
              <Ionicons
                name="file-tray-outline"
                size={28}
                color={colors.muted}
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.emptyCategoryText}>
                {strings.noIncomeThisMonth}
              </Text>
            </View>
          ) : (
            incomeCategories.map((item, index) => {
              const pct =
                totalIncomePaise > 0
                  ? Math.round((item.amountPaise / totalIncomePaise) * 100)
                  : 0;

              return (
                <View
                  key={`inc-${item.category}-${index}`}
                  style={[
                    styles.categoryRowItem,
                    index > 0 && styles.categoryItemDivider,
                  ]}
                >
                  <View style={styles.categoryInfoRow}>
                    <View style={styles.categoryNameContainer}>
                      <Text style={styles.categoryItemName}>
                        {item.category}
                      </Text>
                      <View style={styles.percentagePillGreen}>
                        <Text style={styles.percentageTextGreen}>{pct}%</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.categoryItemAmount,
                        { color: tones.success.fg },
                      ]}
                    >
                      {formatPaiseToRupees(item.amountPaise)}
                    </Text>
                  </View>

                  {/* Horizontal proportion bar */}
                  <View style={styles.barTrackGreen}>
                    <View
                      style={[
                        styles.barFillGreen,
                        { width: `${Math.min(pct, 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* 4. Expense by Category Section */}
      <View style={styles.sectionWrapper}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons
            name="arrow-up-circle"
            size={18}
            color={tones.danger.fg}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.sectionHeaderTitle}>
            {strings.expenseByCategory}
          </Text>
          {expenseCategories.length > 0 && (
            <View style={styles.countBadgeRed}>
              <Text style={styles.countBadgeTextRed}>
                {expenseCategories.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.categoryCard}>
          {expenseCategories.length === 0 ? (
            <View style={styles.emptyCategoryBox}>
              <Ionicons
                name="file-tray-outline"
                size={28}
                color={colors.muted}
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.emptyCategoryText}>
                {strings.noExpenseThisMonth}
              </Text>
            </View>
          ) : (
            expenseCategories.map((item, index) => {
              const pct =
                totalExpensePaise > 0
                  ? Math.round((item.amountPaise / totalExpensePaise) * 100)
                  : 0;

              return (
                <View
                  key={`exp-${item.category}-${index}`}
                  style={[
                    styles.categoryRowItem,
                    index > 0 && styles.categoryItemDivider,
                  ]}
                >
                  <View style={styles.categoryInfoRow}>
                    <View style={styles.categoryNameContainer}>
                      <Text style={styles.categoryItemName}>
                        {item.category}
                      </Text>
                      <View style={styles.percentagePillRed}>
                        <Text style={styles.percentageTextRed}>{pct}%</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.categoryItemAmount,
                        { color: tones.danger.fg },
                      ]}
                    >
                      {formatPaiseToRupees(item.amountPaise)}
                    </Text>
                  </View>

                  {/* Horizontal proportion bar */}
                  <View style={styles.barTrackRed}>
                    <View
                      style={[
                        styles.barFillRed,
                        { width: `${Math.min(pct, 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
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
  monthControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthArrowButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthDisplayBadge: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthDisplayText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    marginLeft: spacing.sm,
  },
  retryButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  totalsSection: {
    marginBottom: spacing.lg,
  },
  totalsCardsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  totalCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: tones.success.fg,
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: tones.danger.fg,
  },
  totalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  totalCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  totalCardAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  netBalanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  netBalancePositive: {
    backgroundColor: '#F8FCF8',
    borderColor: '#C8E6C9',
  },
  netBalanceNegative: {
    backgroundColor: '#FCF8F8',
    borderColor: '#FFCDD2',
  },
  netBalanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  netBalanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  netBalanceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionWrapper: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.xs,
  },
  countBadgeGreen: {
    backgroundColor: tones.success.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  countBadgeTextGreen: {
    fontSize: 11,
    fontWeight: '600',
    color: tones.success.fg,
  },
  countBadgeRed: {
    backgroundColor: tones.danger.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  countBadgeTextRed: {
    fontSize: 11,
    fontWeight: '600',
    color: tones.danger.fg,
  },
  categoryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyCategoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  emptyCategoryText: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
  },
  categoryRowItem: {
    paddingVertical: spacing.xs,
  },
  categoryItemDivider: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  categoryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.xs,
  },
  percentagePillGreen: {
    backgroundColor: tones.success.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  percentageTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: tones.success.fg,
  },
  percentagePillRed: {
    backgroundColor: tones.danger.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  percentageTextRed: {
    fontSize: 11,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  categoryItemAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  barTrackGreen: {
    height: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFillGreen: {
    height: '100%',
    backgroundColor: tones.success.fg,
    borderRadius: 4,
  },
  barTrackRed: {
    height: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFillRed: {
    height: '100%',
    backgroundColor: tones.danger.fg,
    borderRadius: 4,
  },
});
