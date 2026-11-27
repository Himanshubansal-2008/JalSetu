/**
 * ConsumerDetailScreen.js
 * Screen displaying full details of a single consumer, profile metadata,
 * prominent total dues / all clear summary card, and chronological billing history.
 */

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { formatPaiseToRupees } from '../utils/currency';
import { formatDisplay, isoToDateString } from '../utils/dateUtil';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';
import PayBillModal from '../components/PayBillModal';
import { generateAndShareBillPdf } from '../utils/billPdf';

// Formats YYYY-MM to readable string e.g. "November 2026"
function formatMonthName(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return monthStr;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Formats payment timestamp to display date
function formatPaymentDate(dateVal) {
  if (!dateVal) return '';
  const iso = typeof dateVal === 'string' ? dateVal : dateVal.toISOString?.() || '';
  const dateOnly = isoToDateString(iso);
  return formatDisplay(dateOnly) || dateOnly;
}

export default function ConsumerDetailScreen({ route, navigation }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  const consumerId =
    route.params?.consumerId ||
    route.params?.id ||
    route.params?.consumer?.id;

  const initialConsumer = route.params?.consumer;

  const [consumer, setConsumer] = useState(initialConsumer || null);
  const [loading, setLoading] = useState(!initialConsumer);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [payingBillId, setPayingBillId] = useState(null);
  const [selectedBillForPay, setSelectedBillForPay] = useState(null);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [sharingPdfBillId, setSharingPdfBillId] = useState(null);

  const hasDataRef = useRef(!!initialConsumer);
  const requestIdRef = useRef(0);

  // Set header title and admin edit action
  useLayoutEffect(() => {
    navigation.setOptions({
      title: consumer?.name || strings.consumerDetails,
      headerRight: () =>
        isAdmin && consumer ? (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ConsumerForm', { consumer })
            }
            style={styles.headerEditBtn}
            accessibilityRole="button"
            accessibilityLabel={strings.editConsumer}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.headerEditText}>{strings.editEntry || 'Edit'}</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, consumer, isAdmin]);

  // Fetch consumer details from backend
  const fetchConsumer = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!consumerId || !isAdmin) return;

      const currentReqId = ++requestIdRef.current;
      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setLoading(true);
      }
      setError('');

      try {
        const res = await apiClient.get(`/consumers/${consumerId}`);
        if (currentReqId !== requestIdRef.current) return;

        const data = res.data?.consumer || null;
        setConsumer(data);
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
    [consumerId]
  );

  // Re-fetch on focus
  useFocusEffect(
    useCallback(() => {
      fetchConsumer();
    }, [fetchConsumer])
  );

  // Handle Pay Now for a pending bill
  const handlePayNow = (bill) => {
    if (!isAdmin) return;
    const billWithConsumer = {
      ...bill,
      consumer: bill.consumer || {
        name: consumer?.name,
        houseNumber: consumer?.houseNumber,
      },
    };
    setSelectedBillForPay(billWithConsumer);
    setPayModalVisible(true);
  };

  // Share Bill / Receipt PDF
  const handleShareBill = async (bill) => {
    if (sharingPdfBillId) return;
    setSharingPdfBillId(bill.id);
    try {
      await generateAndShareBillPdf({
        bill,
        consumer: bill.consumer || consumer,
      });
    } finally {
      setSharingPdfBillId(null);
    }
  };

  const submitPayment = async (billId, mode) => {
    setPayingBillId(billId);
    try {
      await apiClient.post(`/bills/${billId}/pay`, { mode });
      // Re-fetch consumer to update dues and billing history
      await fetchConsumer({ isRefresh: true });
    } catch (err) {
      Alert.alert('Payment Failed', getErrorMessage(err));
    } finally {
      setPayingBillId(null);
    }
  };

  const isInactive = consumer && !consumer.isActive;
  const totalDues = consumer?.totalDuesPaise ?? consumer?.pendingDuesPaise ?? 0;
  const totalPaid = consumer?.totalPaidPaise ?? 0;
  const bills = consumer?.bills || [];

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
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchConsumer({ isRefresh: true })}
            colors={[colors.primary]}
          />
        }
      >
      {/* Loading state */}
      {loading && !consumer ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && !consumer ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={colors.danger}
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchConsumer()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Retry fetching consumer details"
          >
            <Text style={styles.retryButtonText}>{strings.retry || 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      ) : consumer ? (
        <>
          {/* Error Banner when refreshed */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.danger}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryMiniButton}
                onPress={() => fetchConsumer()}
                activeOpacity={0.8}
              >
                <Text style={styles.retryMiniButtonText}>{strings.retry || 'Retry'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* 1. Consumer Profile Card */}
          <View style={[styles.profileCard, isInactive && styles.profileCardInactive]}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.nameContainer}>
                <Text style={styles.consumerName}>{consumer.name}</Text>
                <View style={styles.houseBadge}>
                  <Text style={styles.houseBadgeText}>{consumer.houseNumber}</Text>
                </View>
              </View>

              {isInactive ? (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>
                    {strings.inactiveStatus}
                  </Text>
                </View>
              ) : (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    {strings.activeStatus}
                  </Text>
                </View>
              )}
            </View>

            {/* Phone Number */}
            {consumer.phone ? (
              <TouchableOpacity
                style={styles.phoneRow}
                onPress={() => Linking.openURL(`tel:${consumer.phone}`)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="call-outline"
                  size={15}
                  color={colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.phoneText}>{consumer.phone}</Text>
                <Ionicons
                  name="open-outline"
                  size={13}
                  color={colors.muted}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            ) : null}

            {/* Monthly Tariff */}
            <View style={styles.tariffRow}>
              <Text style={styles.tariffLabel}>{strings.monthlyTariff}:</Text>
              <Text style={styles.tariffValue}>
                {formatPaiseToRupees(consumer.monthlyChargePaise)}
                <Text style={styles.tariffSuffix}>{strings.monthlyRateSuffix}</Text>
              </Text>
            </View>
          </View>

          {/* 2. Total Pending Dues Summary Card */}
          <View style={styles.duesSummaryCard}>
            {/* Pending Dues Box */}
            <View
              style={[
                styles.duesBox,
                totalDues > 0 ? styles.duesBoxPending : styles.duesBoxCleared,
              ]}
            >
              <View style={styles.duesBoxHeader}>
                <Ionicons
                  name={totalDues > 0 ? 'alert-circle' : 'checkmark-circle'}
                  size={18}
                  color={totalDues > 0 ? tones.danger.fg : tones.success.fg}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.duesBoxTitle}>
                  {strings.totalPendingDues}
                </Text>
              </View>

              <Text
                style={[
                  styles.duesBoxAmount,
                  { color: totalDues > 0 ? tones.danger.fg : tones.success.fg },
                ]}
              >
                {totalDues > 0
                  ? formatPaiseToRupees(totalDues)
                  : `${formatPaiseToRupees(0)} (${strings.allClear})`}
              </Text>
            </View>

            {/* Paid Summary Row */}
            <View style={styles.paidRow}>
              <Text style={styles.paidLabel}>{strings.totalPaid}:</Text>
              <Text style={styles.paidValue}>
                {formatPaiseToRupees(totalPaid)}
              </Text>
            </View>
          </View>

          {/* 3. Chronological Bills List (Billing History) */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons
                name="receipt-outline"
                size={18}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.sectionTitle}>{strings.billingHistory}</Text>
            </View>
            <View style={styles.billsCountBadge}>
              <Text style={styles.billsCountText}>{bills.length}</Text>
            </View>
          </View>

          {bills.length === 0 ? (
            <View style={styles.emptyBillsCard}>
              <Ionicons
                name="document-text-outline"
                size={40}
                color={colors.muted}
                style={{ marginBottom: spacing.xs }}
              />
              <Text style={styles.emptyBillsText}>{strings.noBillsYet}</Text>
            </View>
          ) : (
            bills.map((bill) => {
              const isPaid = bill.status === 'PAID';
              const isPaying = payingBillId === bill.id;

              return (
                <View
                  key={bill.id}
                  style={[
                    styles.billRowCard,
                    isPaid ? styles.billRowCardPaid : styles.billRowCardPending,
                  ]}
                >
                  {/* Top Bill Info Row: Month & Amount */}
                  <View style={styles.billTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.billMonthText}>
                        {formatMonthName(bill.month)}
                      </Text>
                      {bill.reference ? (
                        <Text style={styles.billRefText}>
                          Ref: {bill.reference}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.billAmountText}>
                      {formatPaiseToRupees(bill.amountPaise)}
                    </Text>
                  </View>

                  {/* Bottom Bill Info Row: Status Pill & Payment Info / Pay Now Button */}
                  <View style={styles.billBottomRow}>
                    {isPaid ? (
                      <View style={styles.paidInfoRow}>
                        <View style={styles.paidStatusWrap}>
                          <View style={styles.statusPillPaid}>
                            <Ionicons
                              name="checkmark-circle"
                              size={12}
                              color={tones.success.fg}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.statusPillPaidText}>PAID</Text>
                          </View>
                          <Text style={styles.paidMetaText} numberOfLines={1}>
                            Paid on {formatPaymentDate(bill.paidAt)} • {bill.mode || 'Cash'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.shareBtn}
                          onPress={() => handleShareBill(bill)}
                          disabled={sharingPdfBillId === bill.id}
                          accessibilityRole="button"
                          accessibilityLabel={strings.shareReceiptPdf || 'Share Receipt PDF'}
                        >
                          {sharingPdfBillId === bill.id ? (
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
                    ) : (
                      <View style={styles.pendingActionRow}>
                        <View style={styles.statusPillPending}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={tones.danger.fg}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.statusPillPendingText}>DUE</Text>
                        </View>

                        <View style={styles.pendingButtonsRow}>
                          <TouchableOpacity
                            style={styles.shareBtn}
                            onPress={() => handleShareBill(bill)}
                            disabled={sharingPdfBillId === bill.id}
                            accessibilityRole="button"
                            accessibilityLabel={strings.shareBillPdf || 'Share Bill PDF'}
                          >
                            {sharingPdfBillId === bill.id ? (
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

                          {/* Pay Now Button */}
                          {isAdmin ? (
                            <TouchableOpacity
                              style={styles.payNowBtn}
                              onPress={() => handlePayNow(bill)}
                              disabled={isPaying}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel={`${strings.payNow} for ${bill.month}`}
                            >
                              {isPaying ? (
                                <ActivityIndicator size="small" color={colors.white} />
                              ) : (
                                <>
                                  <Ionicons
                                    name="wallet-outline"
                                    size={13}
                                    color={colors.white}
                                    style={{ marginRight: 4 }}
                                  />
                                  <Text style={styles.payNowBtnText}>
                                    {strings.payNow}
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
            })
          )}
        </>
      ) : null}
    </ScrollView>

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
        await fetchConsumer({ isRefresh: true });
      }}
    />
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  centered: {
    paddingVertical: spacing.xl * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerEditText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    color: tones.danger.fg,
    fontSize: 13,
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  profileCardInactive: {
    backgroundColor: '#F8FAFC',
    opacity: 0.8,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  consumerName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  houseBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  houseBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  activeBadge: {
    backgroundColor: tones.success.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: tones.success.fg,
  },
  inactiveBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  phoneText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  tariffRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tariffLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  tariffValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  tariffSuffix: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.muted,
  },
  duesSummaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  duesBox: {
    borderRadius: radius.sm + 2,
    padding: spacing.md,
    borderWidth: 1,
  },
  duesBoxPending: {
    backgroundColor: tones.danger.bg,
    borderColor: tones.danger.fg,
  },
  duesBoxCleared: {
    backgroundColor: tones.success.bg,
    borderColor: tones.success.fg,
  },
  duesBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  duesBoxTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  duesBoxAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  paidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
  },
  paidLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  paidValue: {
    fontSize: 15,
    fontWeight: '700',
    color: tones.success.fg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  billsCountBadge: {
    backgroundColor: tones.info.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  billsCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: tones.info.fg,
  },
  emptyBillsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyBillsText: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
  },
  billRowCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  billRowCardPaid: {
    borderLeftWidth: 4,
    borderLeftColor: tones.success.fg,
  },
  billRowCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: tones.danger.fg,
  },
  billTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  billMonthText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  billRefText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  billAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  billBottomRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  paidStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paidInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paidStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
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
  statusPillPaid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.success.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusPillPaidText: {
    fontSize: 10,
    fontWeight: '700',
    color: tones.success.fg,
  },
  paidMetaText: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  pendingActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPillPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusPillPendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm + 2,
    minHeight: 32,
  },
  payNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  errorContainer: {
    backgroundColor: tones.danger.bg,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: '#F8B4B4',
  },
  retryButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tones.danger.fg,
    marginTop: spacing.md,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  retryMiniButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tones.danger.fg,
    marginLeft: spacing.sm,
  },
  retryMiniButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: tones.danger.fg,
  },
});
