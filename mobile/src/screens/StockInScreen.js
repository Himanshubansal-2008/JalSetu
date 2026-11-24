/**
 * StockInScreen.js
 * Form screen for recording Stock IN transactions (Admin only).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { strings } from '../strings';

export default function StockInScreen({ route }) {
  const { name, unit, currentQuantity } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name || strings.stockInTitle}</Text>
      {currentQuantity !== undefined ? (
        <Text style={styles.stockText}>
          Current stock: {currentQuantity} {unit || ''}
        </Text>
      ) : null}
      <Text style={styles.info}>
        Stock IN form fields (quantity, note) will load here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stockText: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  info: {
    fontSize: 15,
    color: colors.text,
  },
});
