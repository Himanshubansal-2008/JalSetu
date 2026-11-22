/**
 * StatusBadge.js
 * A small generic pill badge for status labels, warnings, and alerts.
 *
 * Props:
 * - label (string): Text shown inside the badge
 * - tone (string, optional): One of 'success' | 'danger' | 'warning' | 'neutral' (default 'neutral')
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tones, radius, spacing } from '../theme';

export default function StatusBadge({ label, tone = 'neutral' }) {
  const currentTone = tones[tone] || tones.neutral;

  return (
    <View
      style={[styles.badge, { backgroundColor: currentTone.bg }]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, { color: currentTone.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
