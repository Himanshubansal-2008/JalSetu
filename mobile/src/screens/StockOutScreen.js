/**
 * StockOutScreen.js
 * Form screen for recording Stock OUT transactions (Admin and Worker).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { strings } from '../strings';

export default function StockOutScreen({ route }) {
  const { name, unit, currentQuantity } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name || strings.stockOutTitle}</Text>
      {currentQuantity !== undefined ? (
        <Text style={styles.stockText}>
          Available stock: {currentQuantity} {unit || ''}
        </Text>
      ) : null}
      <Text style={styles.info}>
        Stock OUT form fields (quantity, linked asset, note) will load here.
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
