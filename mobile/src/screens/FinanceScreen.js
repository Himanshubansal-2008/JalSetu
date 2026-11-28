/**
 * FinanceScreen.js
 * Landing dashboard for the Finance module (restricted to admin users).
 * Displays current month's Income, Expense, and Net Balance metric cards,
 * Quick Action buttons (Add Receipt, Add Expense, Cash Book),
 * category breakdown preview, and error/refresh handling.
 */

import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
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
import MetricCard from '../components/MetricCard';
import ErrorBanner from '../components/ErrorBanner';

export default function FinanceScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Compute current month string "YYYY-MM" and display label
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthDisplay = now.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  // State
  const [summary, setSummary] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

  // Set navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: strings.financeTitle,
    });
  }, [navigation]);

  // Fetch summary
  const fetchSummary = useCallback(
    async ({ isRefresh = false } = {}) => {
      // Route guard: Non-admin users must never trigger /api/finance/* calls
      if (!isAdmin) {
        return;
      }

      const currentReqId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setInitialLoading(true);
      }
      setError('');

      try {
        const response = await apiClient.get('/finance/summary', {
          params: { month: currentMonth },
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
    [isAdmin, currentMonth]
  );

  // Fetch on focus and mount
  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        fetchSummary();
      }
    }, [isAdmin, fetchSummary])
  );

  // Pull to refresh handler
  const handleRefresh = useCallback(() => {
    fetchSummary({ isRefresh: true });
  }, [fetchSummary]);

  // Route Guard View for Non-Admin
  if (!isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.lockIconCircle}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.danger} />
        </View>
        <Text style={styles.unauthorizedTitle}>{strings.adminAccessOnly}</Text>
        <Text style={styles.unauthorizedMessage}>
          {strings.adminAccessOnlyMessage}
        </Text>
      </View>
    );
  }

  // Initial Loading View
  if (initialLoading && !hasDataRef.current) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const incomeTotal = summary?.income?.totalIncomePaise ?? 0;
  const expenseTotal = summary?.expense?.totalExpensePaise ?? 0;
  const netBalance = summary?.netBalancePaise ?? (incomeTotal - expenseTotal);
  const incomeCategories = summary?.income?.categories ?? [];
  const expenseCategories = summary?.expense?.categories ?? [];
  const hasTransactions = incomeCategories.length > 0 || expenseCategories.length > 0;

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
      {/* Month Header Banner */}
      <View style={styles.monthBanner}>
        <View style={styles.monthBadge}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.monthBadgeText}>{monthDisplay}</Text>
        </View>
      </View>

      {/* Error Notice */}
      <ErrorBanner
        error={error}
        onRetry={() => fetchSummary()}
        retryLabel={strings.retry}
      />

      {/* Metric Cards */}
      <View style={styles.metricsRow}>
        <MetricCard
          label={strings.income}
          value={formatPaiseToRupees(incomeTotal)}
          subtitle={strings.totalReceipts}
          icon="arrow-down"
          tone="success"
        />
        <MetricCard
          label={strings.expense}
          value={formatPaiseToRupees(expenseTotal)}
          subtitle={strings.totalExpenses}
          icon="arrow-up"
          tone="danger"
        />
      </View>

      {/* Net Balance Card */}
      <View
        style={[
          styles.netBalanceCard,
          netBalance >= 0 ? styles.netBalancePositive : styles.netBalanceNegative,
        ]}
      >
        <View style={styles.netBalanceContent}>
          <View style={styles.netBalanceHeader}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor:
                    netBalance >= 0 ? tones.success.bg : tones.danger.bg,
                },
              ]}
            >
              <Ionicons
                name="wallet-outline"
                size={18}
                color={netBalance >= 0 ? tones.success.fg : tones.danger.fg}
              />
            </View>
            <Text style={styles.netBalanceLabel}>{strings.netBalance}</Text>
          </View>
          <Text
            style={[
              styles.netBalanceValue,
              { color: netBalance >= 0 ? tones.success.fg : tones.danger.fg },
            ]}
          >
            {formatPaiseToRupees(netBalance, { showSign: true })}
          </Text>
        </View>
      </View>

      {/* Quick Action Buttons */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsContainer}>
        {/* Add Receipt */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('FinanceEntryForm', {
              initialType: 'RECEIPT',
              mode: 'RECEIPT',
            })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: tones.success.bg }]}>
            <Ionicons name="add-circle" size={24} color={tones.success.fg} />
          </View>
          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>{strings.addReceipt}</Text>
            <Text style={styles.actionSubtitle}>{strings.receiptModeSubtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Add Expense */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('FinanceEntryForm', {
              initialType: 'EXPENSE',
              mode: 'EXPENSE',
            })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: tones.danger.bg }]}>
            <Ionicons name="remove-circle" size={24} color={tones.danger.fg} />
          </View>
          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>{strings.addExpense}</Text>
            <Text style={styles.actionSubtitle}>{strings.expenseModeSubtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Cash Book */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('CashBook', { month: currentMonth })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: tones.info.bg }]}>
            <Ionicons name="book" size={22} color={colors.primary} />
          </View>
          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>{strings.cashBook}</Text>
            <Text style={styles.actionSubtitle}>{strings.cashBookSubtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Monthly Summary */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('MonthlySummary', { month: currentMonth })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: tones.warning.bg }]}>
            <Ionicons name="pie-chart" size={22} color={tones.warning.fg} />
          </View>
          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>{strings.monthlySummary}</Text>
            <Text style={styles.actionSubtitle}>{strings.monthlySummarySubtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Month Category Breakdown Section */}
      <View style={styles.breakdownHeaderRow}>
        <Text style={styles.sectionTitle}>{strings.monthlyBreakdown}</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('MonthlySummary', { month: currentMonth })
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.viewAllLink}>{strings.viewMonthlyBreakdown} →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.breakdownCard}>
        {!hasTransactions ? (
          <Text style={styles.emptyBreakdownText}>
            {strings.noTransactionsThisMonth}
          </Text>
        ) : (
          <View>
            {/* Income breakdown items */}
            {incomeCategories.length > 0 && (
              <View style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>
                  {strings.income} ({incomeCategories.length})
                </Text>
                {incomeCategories.map((item, index) => (
                  <View key={`income-${index}`} style={styles.categoryRow}>
                    <View style={styles.categoryTagDotGreen} />
                    <Text style={styles.categoryName}>{item.category}</Text>
                    <Text style={[styles.categoryAmount, { color: tones.success.fg }]}>
                      {formatPaiseToRupees(item.amountPaise)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Expense breakdown items */}
            {expenseCategories.length > 0 && (
              <View
                style={[
                  styles.categorySection,
                  incomeCategories.length > 0 && styles.categorySectionDivider,
                ]}
              >
                <Text style={styles.categorySectionTitle}>
                  {strings.expense} ({expenseCategories.length})
                </Text>
                {expenseCategories.map((item, index) => (
                  <View key={`expense-${index}`} style={styles.categoryRow}>
                    <View style={styles.categoryTagDotRed} />
                    <Text style={styles.categoryName}>{item.category}</Text>
                    <Text style={[styles.categoryAmount, { color: tones.danger.fg }]}>
                      {formatPaiseToRupees(item.amountPaise)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tones.danger.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  unauthorizedMessage: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  monthBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.info.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  monthBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  netBalanceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  netBalancePositive: {
    backgroundColor: '#F7FCF7',
    borderColor: '#C8E6C9',
  },
  netBalanceNegative: {
    backgroundColor: '#FDF7F7',
    borderColor: '#FFCDD2',
  },
  netBalanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netBalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  netBalanceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  netBalanceValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  actionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  breakdownCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyBreakdownText: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  categorySection: {
    gap: spacing.sm,
  },
  categorySectionDivider: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categorySectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  categoryTagDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tones.success.fg,
    marginRight: spacing.sm,
  },
  categoryTagDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tones.danger.fg,
    marginRight: spacing.sm,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
});
