/**
 * InventoryDetailScreen.js
 * Screen displaying details and stock history for a single inventory item.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { strings } from '../strings';

export default function InventoryDetailScreen({ route }) {
  const itemId = route.params?.itemId || route.params?.id;
  const name = route.params?.name || strings.inventoryDetailTitle;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>ID: {itemId}</Text>
      <Text style={styles.info}>Detail view and stock transactions will load here.</Text>
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
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  info: {
    fontSize: 15,
    color: colors.text,
  },
});
