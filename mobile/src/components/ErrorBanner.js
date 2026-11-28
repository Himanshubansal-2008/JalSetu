/**
 * ErrorBanner.js
 * Standardized error notification banner with retry action button.
 *
 * Props:
 * - error (string): Error message to display
 * - onRetry (function, optional): Callback when retry is pressed
 * - retryLabel (string, optional, default: 'Retry')
 * - containerStyle (object, optional)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

export default function ErrorBanner({
  error,
  onRetry,
  retryLabel = 'Retry',
  containerStyle,
}) {
  if (!error) return null;

  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons
        name="alert-circle-outline"
        size={18}
        color={colors.danger}
        style={styles.icon}
      />
      <Text style={styles.errorText} numberOfLines={2}>
        {error}
      </Text>
      {onRetry ? (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Text style={styles.retryButtonText}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  icon: {
    marginRight: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: colors.danger,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
