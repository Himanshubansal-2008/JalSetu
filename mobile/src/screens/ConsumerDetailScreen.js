/**
 * ConsumerDetailScreen.js
 * Screen displaying full details of a single consumer, dues, and payment history.
 */

import React, { useState, useCallback } from 'react';
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
import { formatPaiseToRupees } from '../utils/currency';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

export default function ConsumerDetailScreen({ route, navigation }) {
  const { id, consumer: initialConsumer } = route.params || {};

  const [consumer, setConsumer] = useState(initialConsumer || null);
  const [loading, setLoading] = useState(!initialConsumer);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchConsumer = useCallback(
    async ({ isRefresh = false } = {}) => {
      const consumerId = id || initialConsumer?.id;
      if (!consumerId) return;

      if (isRefresh) setRefreshing(true);
      else if (!consumer) setLoading(true);
      setError('');

      try {
        const res = await apiClient.get(`/consumers/${consumerId}`);
        setConsumer(res.data?.consumer || null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, initialConsumer, consumer]
  );

  useFocusEffect(
    useCallback(() => {
      fetchConsumer();
    }, [fetchConsumer])
  );

  const isInactive = consumer && !consumer.isActive;
  const dues = consumer?.totalDuesPaise || consumer?.pendingDuesPaise || 0;
  const paid = consumer?.totalPaidPaise || 0;
  const bills = consumer?.bills || [];

  return (
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
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : consumer ? (
        <>
          {/* Consumer Overview Card */}
          <View style={[styles.card, isInactive && styles.cardInactive]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{consumer.name}</Text>
                <Text style={styles.houseNumber}>
                  House: {consumer.houseNumber}
                </Text>
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

            {consumer.phone ? (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={15} color={colors.muted} />
                <Text style={styles.infoText}>{consumer.phone}</Text>
              </View>
            ) : null}

            <View style={styles.tariffRow}>
              <Text style={styles.tariffLabel}>Monthly Tariff:</Text>
              <Text style={styles.tariffValue}>
                {formatPaiseToRupees(consumer.monthlyChargePaise)}
                <Text style={{ fontSize: 12, fontWeight: 'normal' }}>/mo</Text>
              </Text>
            </View>

            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                navigation.navigate('ConsumerForm', { consumer })
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="pencil"
                size={16}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.editButtonText}>{strings.editConsumer}</Text>
            </TouchableOpacity>
          </View>

          {/* Dues Summary Bar */}
          <View style={styles.duesCard}>
            <View style={styles.duesCol}>
              <Text style={styles.duesLabel}>Total Pending Dues</Text>
              <Text
                style={[
                  styles.duesAmount,
                  { color: dues > 0 ? tones.danger.fg : tones.success.fg },
                ]}
              >
                {formatPaiseToRupees(dues)}
              </Text>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.duesCol}>
              <Text style={styles.duesLabel}>Total Paid</Text>
              <Text style={[styles.duesAmount, { color: tones.success.fg }]}>
                {formatPaiseToRupees(paid)}
              </Text>
            </View>
          </View>

          {/* Billing History Section */}
          <Text style={styles.sectionTitle}>Billing History</Text>
          {bills.length === 0 ? (
            <View style={styles.emptyBills}>
              <Text style={styles.emptyBillsText}>
                No bills generated for this consumer yet.
              </Text>
            </View>
          ) : (
            bills.map((b) => {
              const isPaid = b.status === 'PAID';
              return (
                <View key={b.id} style={styles.billItem}>
                  <View>
                    <Text style={styles.billMonth}>{b.month}</Text>
                    <Text style={styles.billAmount}>
                      {formatPaiseToRupees(b.amountPaise)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.billStatusBadge,
                      {
                        backgroundColor: isPaid
                          ? tones.success.bg
                          : tones.danger.bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.billStatusText,
                        {
                          color: isPaid ? tones.success.fg : tones.danger.fg,
                        },
                      ]}
                    >
                      {b.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </>
      ) : null}
    </ScrollView>
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
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: tones.danger.bg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: spacing.md,
  },
  errorText: {
    color: tones.danger.fg,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardInactive: {
    backgroundColor: '#F8FAFC',
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  houseNumber: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: tones.success.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
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
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  infoText: {
    fontSize: 13,
    color: colors.muted,
    marginLeft: 6,
  },
  tariffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tariffLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  tariffValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: tones.info.bg,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  duesCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  duesCol: {
    flex: 1,
    alignItems: 'center',
  },
  dividerVertical: {
    width: 1,
    backgroundColor: colors.border,
  },
  duesLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  duesAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyBills: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyBillsText: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
  },
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs + 2,
  },
  billMonth: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  billAmount: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  billStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  billStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
