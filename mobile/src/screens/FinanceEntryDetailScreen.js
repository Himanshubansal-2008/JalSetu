/**
 * FinanceEntryDetailScreen.js
 * Screen displaying the full details of a single ledger entry (receipt or expense).
 */

import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPaiseToRupees } from '../utils/currency';
import { formatDisplay, isoToDateString } from '../utils/dateUtil';
import { typeLabel } from '../utils/assetUtil';
import { colors, tones, spacing, radius } from '../theme';

export default function FinanceEntryDetailScreen({ route, navigation }) {
  const entry = route.params?.entry || {};
  const isReceipt = entry.type === 'RECEIPT';

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isReceipt ? 'Receipt Details' : 'Expense Details',
    });
  }, [navigation, isReceipt]);

  const amountPaise = entry.amountPaise != null ? entry.amountPaise : entry.amount || 0;
  const displayDate = formatDisplay(entry.date) || isoToDateString(entry.date);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Top Amount Banner */}
      <View style={[styles.amountCard, isReceipt ? styles.amountCardReceipt : styles.amountCardExpense]}>
        <View style={styles.typeBadge}>
          <Ionicons
            name={isReceipt ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={16}
            color={isReceipt ? tones.success.fg : tones.danger.fg}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.typeBadgeText, { color: isReceipt ? tones.success.fg : tones.danger.fg }]}>
            {isReceipt ? 'Receipt' : 'Expense'}
          </Text>
        </View>

        <Text style={[styles.amountText, { color: isReceipt ? tones.success.fg : tones.danger.fg }]}>
          {isReceipt ? '+' : '-'}
          {formatPaiseToRupees(amountPaise)}
        </Text>
        <Text style={styles.categoryTitle}>{entry.category || 'General'}</Text>
      </View>

      {/* Details Card */}
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{displayDate}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payment Mode</Text>
          <Text style={styles.detailValue}>{entry.mode || 'Cash'}</Text>
        </View>

        {entry.runningBalancePaise != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Running Balance</Text>
            <Text style={[styles.detailValue, { fontWeight: '700' }]}>
              {formatPaiseToRupees(entry.runningBalancePaise)}
            </Text>
          </View>
        )}

        {entry.asset && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Linked Asset</Text>
            <Text style={[styles.detailValue, { color: colors.primary }]}>
              {entry.asset.name} ({typeLabel(entry.asset.type)})
            </Text>
          </View>
        )}

        {entry.reference ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reference #</Text>
            <Text style={styles.detailValue}>{entry.reference}</Text>
          </View>
        ) : null}

        {entry.description ? (
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
              {entry.description}
            </Text>
          </View>
        ) : null}
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
  },
  amountCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountCardReceipt: {
    backgroundColor: '#F8FCF8',
    borderColor: '#C8E6C9',
  },
  amountCardExpense: {
    backgroundColor: '#FCF8F8',
    borderColor: '#FFCDD2',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  categoryTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
});
