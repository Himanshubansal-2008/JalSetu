/**
 * EmptyState.js
 * A reusable empty state view displaying an icon, message, and optional action button.
 *
 * Props:
 * - message (string): The message explaining why the screen is empty
 * - actionLabel (string, optional): Text for the action button
 * - onAction (function, optional): Callback when the action button is pressed
 * - icon (string, optional): Ionicons icon name (default: 'cube-outline')
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';
import { colors, spacing } from '../theme';

export default function EmptyState({
  message,
  actionLabel,
  onAction,
  icon = 'cube-outline',
}) {
  return (
    <View style={styles.container} accessible={true} accessibilityLabel={message}>
      {icon ? (
        <Ionicons
          name={icon}
          size={56}
          color={colors.muted}
          style={styles.icon}
        />
      ) : null}

      <Text style={styles.message}>{message}</Text>

      {actionLabel && onAction ? (
        <View style={styles.buttonWrapper}>
          <PrimaryButton
            title={actionLabel}
            onPress={onAction}
            variant="primary"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: 220,
  },
  icon: {
    marginBottom: spacing.md,
  },
  message: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  buttonWrapper: {
    width: '100%',
    maxWidth: 240,
  },
});
