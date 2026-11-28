/**
 * StatusBadge.js
 * A small generic pill badge for status labels, warnings, and alerts.
 *
 * Props:
 * - label (string): Text shown inside the badge
 * - tone (string, optional): One of 'success' | 'danger' | 'warning' | 'info' | 'neutral' (default 'neutral')
 * - icon (node, optional): Optional React element (e.g. Ionicons) rendered before the label
 * - style (object, optional): Additional container styles
 * - textStyle (object, optional): Additional text styles
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tones, radius, spacing } from '../theme';

export default function StatusBadge({ label, tone = 'neutral', icon, style, textStyle }) {
  const currentTone = tones[tone] || tones.neutral;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: currentTone.bg },
        icon ? styles.badgeWithIcon : null,
        style,
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={[styles.label, { color: currentTone.fg }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeWithIcon: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  iconContainer: {
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
