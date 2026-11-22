/**
 * ChipSelector.js
 * A row of tap-to-select chips for filters and forms.
 *
 * Props:
 * - options (array of { value, label }): Available chip options
 * - value (any): Currently selected value or null
 * - onChange (function): Callback invoked with selected value (or null if deselected)
 * - label (string, optional): Title label displayed above the chips
 * - error (string, optional): Error message displayed below the chips
 * - scrollable (boolean, optional): When true, renders a horizontal ScrollView without scrollbar;
 *                                   when false (default), chips wrap onto multiple lines.
 * - allowDeselect (boolean, optional): When true, tapping an already selected chip calls onChange(null)
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function ChipSelector({
  options = [],
  value = null,
  onChange,
  label,
  error,
  scrollable = false,
  allowDeselect = false,
}) {
  const handlePress = (optValue) => {
    if (!onChange) return;
    if (value === optValue && allowDeselect) {
      onChange(null);
    } else {
      onChange(optValue);
    }
  };

  const renderChips = () =>
    options.map((option) => {
      const isSelected = value === option.value;

      return (
        <TouchableOpacity
          key={String(option.value)}
          style={[
            styles.chip,
            isSelected ? styles.chipSelected : styles.chipUnselected,
          ]}
          onPress={() => handlePress(option.value)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: isSelected }}
        >
          <Text
            style={[
              styles.chipText,
              isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    });

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {scrollable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {renderChips()}
        </ScrollView>
      ) : (
        <View style={styles.wrapRow}>{renderChips()}</View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipUnselected: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.white,
  },
  chipTextUnselected: {
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
