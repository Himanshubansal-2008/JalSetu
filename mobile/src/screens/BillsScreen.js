/**
 * BillsScreen.js
 * Monthly Bills management screen in the JalSetu mobile app.
 *
 * Features:
 * - Month selector (< / > arrows) with formatted month label
 * - Top 3 metric summary cards: Billed, Collected (green), Pending (amber/red)
 * - Prominent "Generate Bills" action with native Alert.alert confirmation
 * - Filter chips (All, Pending, Paid) & search bar by name or house number
 * - FlatList of bill cards with status highlights, Record Payment action, and Share Bill / PDF action
 * - Robust pull-to-refresh, useFocusEffect, loading, and error-with-retry states
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { formatPaiseToRupees } from '../utils/currency';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';
import PayBillModal from '../components/PayBillModal';
import SearchBar from '../components/SearchBar';
import MetricCard from '../components/MetricCard';
import ErrorBanner from '../components/ErrorBanner';
import StatusBadge from '../components/StatusBadge';
import { generateAndShareBillPdf } from '../utils/billPdf';

// Returns current local month in "YYYY-MM"
function currentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Shifts a "YYYY-MM" month string by delta months (+1 or -1)
function shiftMonth(monthStr, delta) {
  if (!monthStr || typeof monthStr !== 'string') return currentMonthString();
  const [yStr, mStr] = monthStr.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) + delta;
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

// Formats YYYY-MM to readable string e.g. "November 2026"
function formatMonthName(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return '';
  const [yStr, mStr] = monthStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  if (isNaN(year) || isNaN(month)) return monthStr;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Formats payment timestamp to short date e.g. "26 Nov"
function formatPaidDateShort(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export default function BillsScreen({ navigation, route }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Period, search, and filter states
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString);
  const [statusFilter, setStatusFilter] = useState(route?.params?.initialStatus || route?.params?.status || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync if route params change
  useEffect(() => {
    const s = route?.params?.initialStatus || route?.params?.status;
    if (s) {
      setStatusFilter(s);
    }
  }, [route?.params?.initialStatus, route?.params?.status]);

  // Data states
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Action states
  const [generating, setGenerating] = useState(false);
  const [payingBillId, setPayingBillId] = useState(null);
  const [unpayingBillId, setUnpayingBillId] = useState(null);
  const [selectedBillForPay, setSelectedBillForPay] = useState(null);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [sharingPdfBillId, setSharingPdfBillId] = useState(null);

  const hasDataRef = useRef(false);
  const requestIdRef = useRef(0);

  // Fetch bills and dues summary
  const fetchData = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!isAdmin) return;

      const currentReqId = ++requestIdRef.current;
      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setLoading(true);
      }
      setError('');

      try {
        const billsParams = { month: selectedMonth };
        if (statusFilter !== 'ALL') {
          billsParams.status = statusFilter;
        }
        if (searchQuery && searchQuery.trim()) {
          billsParams.search = searchQuery.trim();
        }

        const [billsRes, summaryRes] = await Promise.all([
          apiClient.get('/bills', { params: billsParams }),
          apiClient.get('/bills/summary', { params: { month: selectedMonth } }),
        ]);

        if (currentReqId !== requestIdRef.current) return;

        setBills(billsRes.data?.bills || billsRes.data?.items || []);
        setSummary(summaryRes.data || null);
        hasDataRef.current = true;
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        setError(getErrorMessage(err));
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedMonth, statusFilter, searchQuery]
  );

  // Re-fetch on focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Month navigation
  const handlePrevMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, 1));
  };

  // Search input change handler
  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Generate Bills Confirmation Flow
  const handlePromptGenerateBills = () => {
    if (!isAdmin || generating) return;

    Alert.alert(
      strings.generateBillsConfirmTitle || 'Generate Bills',
      strings.generateBillsConfirmMessage
        ? strings.generateBillsConfirmMessage.replace(
            '{month}',
            formatMonthName(selectedMonth)
          )
        : `Generate water bills for ${formatMonthName(selectedMonth)} for all active consumers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'default',
          onPress: executeGenerateBills,
        },
      ]
    );
  };

  const executeGenerateBills = async () => {
    setGenerating(true);
    try {
      const res = await apiClient.post('/bills/generate', {
        month: selectedMonth,
      });
      const { createdCount = 0, skippedCount = 0 } = res.data || {};

      Alert.alert(
        'Bills Generated',
        `${createdCount} created, ${skippedCount} skipped`
      );

      // Refresh list and summary
      await fetchData({ isRefresh: true });
    } catch (err) {
      Alert.alert('Generation Failed', getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  // Record Payment Flow for Pending Bill
  const handlePayBill = (bill) => {
    if (!isAdmin) return;
    setSelectedBillForPay(bill);
    setPayModalVisible(true);
  };

  const executePayBill = async (billId, mode) => {
    setPayingBillId(billId);
    try {
      await apiClient.post(`/bills/${billId}/pay`, { mode });
      // Refresh list and summary immediately
      await fetchData({ isRefresh: true });
    } catch (err) {
      Alert.alert('Payment Failed', getErrorMessage(err));
    } finally {
      setPayingBillId(null);
    }
  };

  // Reverse Payment Action for Paid Bill
  const handleUnpayBill = (bill) => {
    if (!isAdmin) return;
    Alert.alert(
      'Reverse Bill Payment',
      `Are you sure you want to reverse payment for ${bill.consumer?.name || 'this consumer'} (${bill.month})? This will mark the bill as pending and void the ledger receipt.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse Payment',
          style: 'destructive',
          onPress: async () => {
            setUnpayingBillId(bill.id);
            try {
              await apiClient.post(`/bills/${bill.id}/unpay`);
              await fetchData({ isRefresh: true });
            } catch (err) {
              Alert.alert('Reversal Failed', getErrorMessage(err));
            } finally {
              setUnpayingBillId(null);
            }
          },
        },
      ]
    );
  };

  // Share Bill / PDF Action
  const handleShareBill = async (bill) => {
    if (sharingPdfBillId) return;
    setSharingPdfBillId(bill.id);
    try {
      await generateAndShareBillPdf({
        bill,
        consumer: bill.consumer,
        gp: bill.gp,
      });
    } finally {
      setSharingPdfBillId(null);
    }
  };

  // Render Bill Card
  const renderBillCard = ({ item }) => {
    const isPaid = item.status === 'PAID';
    const isPaying = payingBillId === item.id;

    return (
      <View
        style={[
          styles.billCard,
          isPaid ? styles.billCardPaid : styles.billCardPending,
        ]}
      >
        {/* Top Row: Consumer Name, House Badge, and Amount */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.consumerInfoCol}>
            <View style={styles.nameRow}>
              <Text style={styles.consumerName} numberOfLines={1}>
                {item.consumer?.name || 'Consumer'}
              </Text>
              {item.consumer?.houseNumber ? (
                <View style={styles.houseBadge}>
                  <Text style={styles.houseBadgeText}>
                    {item.consumer.houseNumber}
                  </Text>
                </View>
              ) : null}
            </View>

            {item.reference ? (
              <Text style={styles.billRefText}>Ref: {item.reference}</Text>
            ) : null}
          </View>

          <Text style={styles.billAmountText}>
            {formatPaiseToRupees(item.amountPaise)}
          </Text>
        </View>

        {/* Bottom Row: Status Badge & Payment Action / Share Button */}
        <View style={styles.cardFooterRow}>
          {isPaid ? (
            <View style={styles.paidInfoRow}>
              <StatusBadge
                label={`Paid • ${item.mode || 'Cash'} • ${formatPaidDateShort(item.paidAt)}`}
                tone="success"
                icon={
                  <Ionicons
                    name="checkmark-circle"
                    size={12}
                    color={tones.success.fg}
                  />
                }
              />

              <View style={styles.paidActionsRow}>
                {isAdmin ? (
                  <TouchableOpacity
                    style={styles.reverseBtn}
                    onPress={() => handleUnpayBill(item)}
                    disabled={unpayingBillId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel="Reverse Payment"
                  >
                    {unpayingBillId === item.id ? (
                      <ActivityIndicator size="small" color={tones.danger.fg} />
                    ) : (
                      <>
                        <Ionicons
                          name="arrow-undo-outline"
                          size={13}
                          color={tones.danger.fg}
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.reverseBtnText}>Reverse</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShareBill(item)}
                  disabled={sharingPdfBillId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={strings.shareReceiptPdf || 'Share Receipt PDF'}
                >
                  {sharingPdfBillId === item.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name="share-outline"
                        size={14}
                        color={colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.shareBtnText}>
                        {strings.shareReceiptPdf || 'Share Receipt'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.pendingActionRow}>
              <StatusBadge
                label="Pending"
                tone="danger"
                icon={
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={tones.danger.fg}
                  />
                }
              />

              <View style={styles.pendingButtonsRow}>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShareBill(item)}
                  disabled={sharingPdfBillId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={strings.shareBillPdf || 'Share Bill PDF'}
                >
                  {sharingPdfBillId === item.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name="share-outline"
                        size={14}
                        color={colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.shareBtnText}>
                        {strings.shareBillPdf || 'Share Bill'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {isAdmin ? (
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => handlePayBill(item)}
                    disabled={isPaying}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={strings.recordPayment || 'Record Payment'}
                  >
                    {isPaying ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="wallet-outline"
                          size={14}
                          color={colors.white}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.payBtnText}>
                          {strings.recordPayment || 'Record Payment'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </View>
    );
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

  return (
    <View style={styles.container}>
      {/* 1. Month Selector Header */}
      <View style={styles.monthHeaderRow}>
        <TouchableOpacity
          style={styles.monthArrowButton}
          onPress={handlePrevMonth}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.monthBadge}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.monthText}>{formatMonthName(selectedMonth)}</Text>
        </View>

        <TouchableOpacity
          style={styles.monthArrowButton}
          onPress={handleNextMonth}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 2. Top Metric Summary Cards (Billed, Collected, Pending) */}
      <View style={styles.summaryContainer}>
        <MetricCard
          label={strings.billedLabel || 'Billed'}
          value={formatPaiseToRupees(summary?.totalBilledPaise || 0)}
          subtitle={`${summary?.totalBillsCount || 0} bills`}
          containerStyle={{ marginRight: spacing.xs }}
        />
        <MetricCard
          label={strings.collectedLabel || 'Collected'}
          value={formatPaiseToRupees(summary?.totalCollectedPaise || 0)}
          subtitle={`${summary?.paidBillsCount || 0} paid`}
          tone="success"
          containerStyle={{ marginHorizontal: spacing.xs / 2 }}
        />
        <MetricCard
          label={strings.pendingLabel || 'Pending'}
          value={formatPaiseToRupees(summary?.totalPendingPaise || 0)}
          subtitle={`${summary?.pendingBillsCount || 0} unpaid`}
          tone="danger"
          containerStyle={{ marginLeft: spacing.xs }}
        />
      </View>

      {/* 3. Generate Bills Action Button (Admin Only) */}
      {isAdmin ? (
        <View style={styles.generateButtonSection}>
          <TouchableOpacity
            style={[
              styles.generateButton,
              generating && styles.generateButtonDisabled,
            ]}
            onPress={handlePromptGenerateBills}
            disabled={generating}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={strings.generateBills || 'Generate Bills'}
          >
            {generating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name="flash-outline"
                  size={16}
                  color={colors.white}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.generateButtonText}>
                  {strings.generateBills || 'Generate Bills'} for{' '}
                  {formatMonthName(selectedMonth)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 4. Filter Chips & Search Bar */}
      <View style={styles.filterSection}>
        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchChange}
          onClear={handleClearSearch}
          placeholder={
            strings.searchBillsPlaceholder ||
            'Search by consumer name or house number...'
          }
          containerStyle={{ marginBottom: spacing.sm }}
        />

        {/* Filter Chips */}
        <View style={styles.chipsRow}>
          {[
            { key: 'ALL', label: strings.allFilter || 'All' },
            { key: 'PENDING', label: strings.pendingFilter || 'Pending' },
            { key: 'PAID', label: strings.paidFilter || 'Paid' },
          ].map((chip) => {
            const isSelected = statusFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() => setStatusFilter(chip.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Error Banner with Retry */}
      <ErrorBanner
        error={error}
        onRetry={() => fetchData()}
        retryLabel="Retry"
      />

      {/* 5. Bills List */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => item.id}
          renderItem={renderBillCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData({ isRefresh: true })}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons
                name="receipt-outline"
                size={44}
                color={colors.muted}
                style={{ marginBottom: spacing.xs }}
              />
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'No bills match your search'
                  : strings.noBillsForMonth ||
                    'No bills generated for this month yet'}
              </Text>
              {isAdmin && !searchQuery && bills.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={handlePromptGenerateBills}
                >
                  <Text style={styles.emptyActionBtnText}>
                    Generate Bills Now
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* Pay Bill Modal */}
      <PayBillModal
        visible={payModalVisible}
        bill={selectedBillForPay}
        onClose={() => {
          setPayModalVisible(false);
          setSelectedBillForPay(null);
        }}
        onSuccess={async () => {
          setPayModalVisible(false);
          setSelectedBillForPay(null);
          await fetchData({ isRefresh: true });
        }}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthArrowButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: tones.info.bg,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  summaryCardAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  summaryCardSubtitle: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  generateButtonSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 3,
    borderRadius: radius.md,
    minHeight: 44,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  filterSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs + 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: tones.danger.fg,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
  },
  retryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  billCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  billCardPaid: {
    borderLeftWidth: 4,
    borderLeftColor: tones.success.fg,
  },
  billCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: tones.danger.fg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  consumerInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  consumerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  houseBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
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
  billRefText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  billAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardFooterRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  paidInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: tones.info.bg,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  pendingButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  guardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
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
    lineHeight: 20,
  },
  pendingActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm + 2,
    minHeight: 32,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  paidActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reverseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  reverseBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: tones.danger.fg,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyActionBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.sm + 2,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
