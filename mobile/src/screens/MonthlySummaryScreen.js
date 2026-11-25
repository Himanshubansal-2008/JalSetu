/**
 * MonthlySummaryScreen.js
 * Placeholder/target screen for the Monthly Summary view.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export default function MonthlySummaryScreen({ route }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Summary</Text>
      <Text style={styles.subtitle}>Monthly summary breakdown coming up in next subtask.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
});
