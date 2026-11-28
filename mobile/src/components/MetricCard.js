/**
 * MetricCard.js
 * Standardized KPI / Summary metric card displaying label, formatted value/amount,
 * optional subtitle/count, optional icon, and optional accent tone.
 *
 * Props:
 * - label (string): Metric title (e.g., 'Billed', 'Total Assets')
 * - value (string | number): Primary display value (e.g., '₹15,000' or 42)
 * - subtitle (string, optional): Extra context (e.g., '16 paid', '2 faulty')
 * - icon (string, optional): Ionicons name
 * - tone (string, optional): 'default' | 'success' | 'danger' | 'warning' | 'info'
 * - onPress (function, optional): When provided, renders as interactive TouchableOpacity
 * - containerStyle (object, optional)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, tones, radius, spacing } from '../theme';

export default function MetricCard({
  label,
  value,
  subtitle,
  icon,
  tone = 'default',
  onPress,
  containerStyle,
}) {
  const isPressable = typeof onPress === 'function';
  const Component = isPressable ? TouchableOpacity : View;

  // Determine value text color by tone
  let valueColor = colors.text;
  let iconColor = colors.primary;

  if (tone === 'success') {
    valueColor = tones.success.fg;
    iconColor = tones.success.fg;
  } else if (tone === 'danger') {
    valueColor = tones.danger.fg;
    iconColor = tones.danger.fg;
  } else if (tone === 'warning') {
    valueColor = tones.warning.fg;
    iconColor = tones.warning.fg;
  } else if (tone === 'info') {
    valueColor = tones.info.fg;
    iconColor = tones.info.fg;
  }

  return (
    <Component
      style={[styles.card, containerStyle]}
      onPress={onPress}
      activeOpacity={isPressable ? 0.75 : 1}
      accessibilityRole={isPressable ? 'button' : 'summary'}
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {icon ? (
          <Ionicons name={icon} size={18} color={iconColor} style={styles.icon} />
        ) : null}
      </View>

      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>

      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Component>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  icon: {
    marginLeft: spacing.xs,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: colors.muted,
  },
});
