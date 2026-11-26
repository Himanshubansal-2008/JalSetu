/**
 * BillsScreen.js
 * Screen displaying monthly bills, dues summary, and bill status filters.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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

export default function BillsScreen({ navigation }) {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const params = {};
        if (statusFilter !== 'ALL') {
          params.status = statusFilter;
        }

        const [billsRes, summaryRes] = await Promise.all([
          apiClient.get('/bills', { params }),
          apiClient.get('/bills/summary'),
        ]);

        setBills(billsRes.data?.bills || []);
        setSummary(summaryRes.data || null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  return (
    <View style={styles.container}>
      {/* Top Summary Banner */}
      {summary ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Billed</Text>
            <Text style={styles.summaryAmount}>
              {formatPaiseToRupees(summary.totalBilledPaise)}
            </Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Collected</Text>
            <Text style={[styles.summaryAmount, { color: tones.success.fg }]}>
              {formatPaiseToRupees(summary.totalCollectedPaise)}
            </Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryAmount, { color: tones.danger.fg }]}>
              {formatPaiseToRupees(summary.totalPendingPaise)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Filter Chips: ALL, PENDING, PAID */}
      <View style={styles.filterRow}>
        {['ALL', 'PENDING', 'PAID'].map((status) => {
          const isSelected = statusFilter === status;
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                isSelected && styles.filterChipSelected,
              ]}
              onPress={() => setStatusFilter(status)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextSelected,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error Banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Bills List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData({ isRefresh: true })}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => {
            const isPaid = item.status === 'PAID';
            return (
              <View style={styles.billCard}>
                <View style={styles.billHeader}>
                  <Text style={styles.consumerName}>
                    {item.consumer?.name || 'Consumer'}
                  </Text>
                  <View style={styles.houseBadge}>
                    <Text style={styles.houseText}>
                      {item.consumer?.houseNumber || ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.billDetailsRow}>
                  <Text style={styles.monthText}>Month: {item.month}</Text>
                  <Text style={styles.amountText}>
                    {formatPaiseToRupees(item.amountPaise)}
                  </Text>
                </View>

                <View style={styles.billFooter}>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isPaid
                          ? tones.success.bg
                          : tones.danger.bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isPaid ? tones.success.fg : tones.danger.fg,
                        },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>

                  {item.mode ? (
                    <Text style={styles.modeText}>Paid via {item.mode}</Text>
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={colors.muted}
                style={{ marginBottom: spacing.sm }}
              />
              <Text style={styles.emptyText}>No bills found</Text>
            </View>
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
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  dividerVertical: {
    width: 1,
    backgroundColor: colors.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 2,
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
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
    backgroundColor: tones.danger.bg,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: tones.danger.fg,
    fontSize: 13,
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
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  consumerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  houseBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  houseText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  billDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  monthText: {
    fontSize: 13,
    color: colors.muted,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  billFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modeText: {
    fontSize: 11,
    color: colors.muted,
  },
  emptyContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
  },
});
