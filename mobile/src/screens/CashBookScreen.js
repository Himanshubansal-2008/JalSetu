/**
 * CashBookScreen.js
 * Chronological date-wise Cash Book ledger screen with Month & Custom Date Range filtering,
 * opening balance card, running balance progression on each row, and closing balance totals.
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
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import DateField from '../components/DateField';
import { formatPaiseToRupees } from '../utils/currency';
import { todayString, formatDisplay, isoToDateString } from '../utils/dateUtil';
import { typeLabel } from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';
import ErrorBanner from '../components/ErrorBanner';

// Month helper: shifts YYYY-MM by delta months
function shiftMonth(monthStr, delta) {
  const [yStr, mStr] = monthStr.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10); // 1-12

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

export default function CashBookScreen({ route, navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Compute default current month
  const now = new Date();
  const defaultCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Period mode: 'MONTH' | 'CUSTOM'
  const [periodMode, setPeriodMode] = useState('MONTH');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return route.params?.month || defaultCurrentMonth;
  });

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState(() => {
    return `${selectedMonth}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return todayString();
  });

  // Data & loading states
  const [cashbook, setCashbook] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Opening balance edit modal state
  const [editObModalVisible, setEditObModalVisible] = useState(false);
  const [obInputRupees, setObInputRupees] = useState('');
  const [updatingOb, setUpdatingOb] = useState(false);
  const [obError, setObError] = useState('');

  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

  // Set navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: strings.cashBook,
    });
  }, [navigation]);

  // Main data fetch
  const fetchCashbook = useCallback(
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
        const params = {};
        if (periodMode === 'MONTH') {
          params.month = selectedMonth;
        } else {
          if (customStartDate && customEndDate) {
            params.startDate = customStartDate;
            params.endDate = customEndDate;
          }
        }

        const response = await apiClient.get('/finance/cashbook', { params });
        if (currentReqId !== requestIdRef.current) return;

        setCashbook(response.data);
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
    [isAdmin, periodMode, selectedMonth, customStartDate, customEndDate]
  );

  // Fetch when period or mode changes, or on screen focus
  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        fetchCashbook();
      }
    }, [isAdmin, fetchCashbook])
  );

  const handleRefresh = useCallback(() => {
    fetchCashbook({ isRefresh: true });
  }, [fetchCashbook]);

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

  const openingBalancePaise = cashbook?.openingBalancePaise ?? 0;
  const totalReceiptsPaise = cashbook?.totalReceiptsPaise ?? 0;
  const totalExpensesPaise = cashbook?.totalExpensesPaise ?? 0;
  const closingBalancePaise = cashbook?.closingBalancePaise ?? 0;
  const entries = cashbook?.entries ?? cashbook?.items ?? [];

  const handleOpenEditOb = () => {
    const currentRupees = (openingBalancePaise / 100).toString();
    setObInputRupees(currentRupees);
    setObError('');
    setEditObModalVisible(true);
  };

  const handleSaveOpeningBalance = async () => {
    const num = parseFloat(obInputRupees);
    if (isNaN(num) || num < 0) {
      setObError('Please enter a valid non-negative amount in ₹');
      return;
    }
    const paise = Math.round(num * 100);
    setUpdatingOb(true);
    setObError('');
    try {
      await apiClient.patch('/gp/opening-balance', { openingBalancePaise: paise });
      setEditObModalVisible(false);
      await fetchCashbook({ isRefresh: true });
    } catch (err) {
      setObError(getErrorMessage(err, 'Failed to update opening balance'));
    } finally {
      setUpdatingOb(false);
    }
  };

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
      {/* 1. Period Selector Toggle (Month vs. Custom Range) */}
      <View style={styles.periodToggleWrapper}>
        <TouchableOpacity
          style={[
            styles.periodToggleTab,
            periodMode === 'MONTH' && styles.periodToggleTabActive,
          ]}
          onPress={() => setPeriodMode('MONTH')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={periodMode === 'MONTH' ? colors.primary : colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.periodToggleText,
              periodMode === 'MONTH' && styles.periodToggleTextActive,
            ]}
          >
            {strings.monthMode}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.periodToggleTab,
            periodMode === 'CUSTOM' && styles.periodToggleTabActive,
          ]}
          onPress={() => setPeriodMode('CUSTOM')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={periodMode === 'CUSTOM' ? colors.primary : colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.periodToggleText,
              periodMode === 'CUSTOM' && styles.periodToggleTextActive,
            ]}
          >
            {strings.customRangeMode}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Period Controls */}
      {periodMode === 'MONTH' ? (
        <View style={styles.monthControlsRow}>
          <TouchableOpacity
            style={styles.monthArrowButton}
            onPress={handlePrevMonth}
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.monthDisplayBadge}>
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
      ) : (
        <View style={styles.customDateRangeCard}>
          <View style={styles.datePickerRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.dateFieldMiniLabel}>{strings.startDate}</Text>
              <DateField
                value={customStartDate}
                onChange={(val) => setCustomStartDate(val)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateFieldMiniLabel}>{strings.endDate}</Text>
              <DateField
                value={customEndDate}
                onChange={(val) => setCustomEndDate(val)}
              />
            </View>
          </View>
        </View>
      )}

      {/* Error Card */}
      <ErrorBanner
        error={error}
        onRetry={() => fetchCashbook()}
        retryLabel={strings.retry}
      />

      {/* 3. Opening Balance Card */}
      <View style={styles.openingBalanceCard}>
        <View style={styles.balanceHeaderRow}>
          <View style={styles.balanceIconLabel}>
            <View style={[styles.balanceIconCircle, { backgroundColor: tones.info.bg }]}>
              <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.balanceCardLabel}>{strings.openingBalance}</Text>
          </View>
          <View style={styles.obHeaderRight}>
            <Text style={styles.balanceDateSubtext}>
              {cashbook?.startDate
                ? `${strings.asOf} ${formatDisplay(cashbook.startDate) || isoToDateString(cashbook.startDate)}`
                : ''}
            </Text>
            {isAdmin ? (
              <TouchableOpacity
                onPress={handleOpenEditOb}
                style={styles.editObBtn}
                accessibilityRole="button"
                accessibilityLabel="Edit Opening Balance"
              >
                <Ionicons name="create-outline" size={13} color={colors.primary} style={{ marginRight: 3 }} />
                <Text style={styles.editObBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <Text style={styles.openingBalanceValue}>
          {formatPaiseToRupees(openingBalancePaise)}
        </Text>
      </View>

      {/* 4. Chronological Ledger List */}
      <View style={styles.ledgerSection}>
        <Text style={styles.sectionHeaderTitle}>
          Ledger Transactions ({entries.length})
        </Text>

        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{strings.noCashbookEntries}</Text>
          </View>
        ) : (
          entries.map((entry) => {
            const isReceipt = entry.type === 'RECEIPT';
            const displayDate =
              formatDisplay(entry.date) || isoToDateString(entry.date);

            return (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryRowCard}
                onPress={() =>
                  navigation.navigate('LedgerEntryDetail', {
                    id: entry.id,
                    entry,
                  })
                }
                activeOpacity={0.7}
              >
                {/* Top Row: Date & Running Balance */}
                <View style={styles.entryRowTop}>
                  <View style={styles.entryDateChip}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={colors.muted}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.entryDateText}>{displayDate}</Text>
                  </View>

                  <View style={styles.runningBalanceBadge}>
                    <Text style={styles.runningBalanceText}>
                      {strings.runningBalancePrefix}{' '}
                      <Text style={{ fontWeight: '700' }}>
                        {formatPaiseToRupees(entry.runningBalancePaise)}
                      </Text>
                    </Text>
                  </View>
                </View>

                {/* Main Row: Category, Icon, Mode, and Amount */}
                <View style={styles.entryRowMain}>
                  <View style={styles.entryIconAndCat}>
                    <View
                      style={[
                        styles.entryTypeCircle,
                        {
                          backgroundColor: isReceipt
                            ? tones.success.bg
                            : tones.danger.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isReceipt ? 'arrow-down' : 'arrow-up'}
                        size={14}
                        color={isReceipt ? tones.success.fg : tones.danger.fg}
                      />
                    </View>
                    <View style={styles.entryCategoryWrapper}>
                      <Text style={styles.entryCategoryText}>
                        {entry.category}
                      </Text>
                      {entry.mode ? (
                        <View style={styles.modeMiniPill}>
                          <Text style={styles.modeMiniPillText}>
                            {entry.mode}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.entryAmountContainer}>
                    <Text
                      style={[
                        styles.entryAmountText,
                        {
                          color: isReceipt
                            ? tones.success.fg
                            : tones.danger.fg,
                        },
                      ]}
                    >
                      {isReceipt ? '+' : '-'}
                      {formatPaiseToRupees(entry.amountPaise || entry.amount)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.muted}
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </View>

                {/* Sub details: Linked Asset, Reference, Description */}
                {(entry.asset || entry.reference || entry.description) && (
                  <View style={styles.entrySubDetails}>
                    {entry.asset ? (
                      <View style={styles.subDetailItem}>
                        <Ionicons
                          name="cube-outline"
                          size={13}
                          color={colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.assetNameText}>
                          {entry.asset.name} • {typeLabel(entry.asset.type)}
                        </Text>
                      </View>
                    ) : null}

                    {entry.reference ? (
                      <View style={styles.subDetailItem}>
                        <Ionicons
                          name="pricetag-outline"
                          size={12}
                          color={colors.muted}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.subDetailText}>
                          Ref: {entry.reference}
                        </Text>
                      </View>
                    ) : null}

                    {entry.description ? (
                      <Text style={styles.subDescriptionText} numberOfLines={2}>
                        {entry.description}
                      </Text>
                    ) : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* 5. Totals & Closing Balance Summary Footer */}
      <View style={styles.summaryFooterCard}>
        <Text style={styles.summaryFooterTitle}>Period Summary</Text>

        <View style={styles.summaryLineRow}>
          <Text style={styles.summaryLineLabel}>{strings.totalReceipts}</Text>
          <Text style={[styles.summaryLineValue, { color: tones.success.fg }]}>
            +{formatPaiseToRupees(totalReceiptsPaise)}
          </Text>
        </View>

        <View style={styles.summaryLineRow}>
          <Text style={styles.summaryLineLabel}>{strings.totalExpenses}</Text>
          <Text style={[styles.summaryLineValue, { color: tones.danger.fg }]}>
            -{formatPaiseToRupees(totalExpensesPaise)}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.closingBalanceRow}>
          <View>
            <Text style={styles.closingBalanceLabel}>
              {strings.closingBalance}
            </Text>
            <Text style={styles.closingBalanceSubtext}>
              Opening + Receipts - Expenses
            </Text>
          </View>
          <Text
            style={[
              styles.closingBalanceValue,
              {
                color:
                  closingBalancePaise >= 0
                    ? colors.text
                    : tones.danger.fg,
              },
            ]}
          >
            {formatPaiseToRupees(closingBalancePaise)}
          </Text>
        </View>
      </View>

      {/* Edit Opening Balance Modal */}
      <Modal
        visible={editObModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditObModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="wallet-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Set Opening Balance</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditObModalVisible(false)}
                disabled={updatingOb}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter the base starting balance for your Gram Panchayat (in ₹). Changes reflect across your Cash Book and monthly summaries.
            </Text>

            {obError ? (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={tones.danger.fg} style={{ marginRight: 6 }} />
                <Text style={styles.modalErrorText}>{obError}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.obTextInput}
                value={obInputRupees}
                onChangeText={setObInputRupees}
                placeholder="0.00"
                keyboardType="numeric"
                editable={!updatingOb}
              />
            </View>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditObModalVisible(false)}
                disabled={updatingOb}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, updatingOb && styles.btnDisabled]}
                onPress={handleSaveOpeningBalance}
                disabled={updatingOb}
              >
                {updatingOb ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Balance</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  periodToggleWrapper: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodToggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md - 2,
  },
  periodToggleTabActive: {
    backgroundColor: tones.info.bg,
  },
  periodToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  periodToggleTextActive: {
    color: colors.primary,
    fontWeight: '600',
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
  customDateRangeCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePickerRow: {
    flexDirection: 'row',
  },
  dateFieldMiniLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 4,
  },
  openingBalanceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: spacing.lg,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  balanceIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  balanceCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  balanceDateSubtext: {
    fontSize: 12,
    color: colors.muted,
  },
  openingBalanceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  ledgerSection: {
    marginBottom: spacing.lg,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  entryRowCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  entryDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryDateText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
  },
  runningBalanceBadge: {
    backgroundColor: tones.neutral.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  runningBalanceText: {
    fontSize: 12,
    color: colors.text,
  },
  entryRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryIconAndCat: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entryTypeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  entryCategoryWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  entryCategoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.xs,
  },
  modeMiniPill: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modeMiniPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  entryAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryAmountText: {
    fontSize: 16,
    fontWeight: '700',
  },
  entrySubDetails: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 3,
  },
  subDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetNameText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  subDetailText: {
    fontSize: 12,
    color: colors.muted,
  },
  subDescriptionText: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic',
  },
  summaryFooterCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  summaryFooterTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLineLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  summaryLineValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  closingBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closingBalanceLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  closingBalanceSubtext: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  closingBalanceValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  obHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editObBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.info.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  editObBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  modalErrorText: {
    color: tones.danger.fg,
    fontSize: 13,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginRight: 6,
  },
  obTextInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 10,
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
