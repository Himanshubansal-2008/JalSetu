/**
 * DetailRow.js
 * A reusable key-value row component for presenting details and metadata.
 *
 * Props:
 * - label (string): Label displayed on the left (or above when multiline)
 * - value (string | node): Value displayed on the right (or below when multiline); shows em-dash if empty/null
 * - multiline (boolean, optional): If true, stacks label above value
 * - extra (node, optional): Optional component (e.g. StatusBadge) rendered alongside value
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { strings } from '../strings';
import { colors, spacing } from '../theme';

export default function DetailRow({
  label,
  value,
  multiline = false,
  extra = null,
}) {
  const displayValue =
    value !== null && value !== undefined && String(value).trim() !== ''
      ? value
      : strings.emDash;

  if (multiline) {
    return (
      <View
        style={styles.multilineContainer}
        accessible={true}
        accessibilityLabel={`${label}: ${typeof displayValue === 'string' ? displayValue : ''}`}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.multilineValue}>{displayValue}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.rowContainer}
      accessible={true}
      accessibilityLabel={`${label}: ${typeof displayValue === 'string' ? displayValue : ''}`}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueWrapper}>
        <Text style={styles.value} numberOfLines={2}>
          {displayValue}
        </Text>
        {extra}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  multilineContainer: {
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 14,
    color: colors.muted,
    flex: 1,
    marginRight: spacing.sm,
  },
  valueWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  value: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    textAlign: 'right',
  },
  multilineValue: {
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
});
