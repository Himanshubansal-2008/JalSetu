/**
 * PrimaryButton.js
 * A reusable accessible button supporting primary, secondary, and danger variants,
 * with built-in loading spinner and disabled states.
 *
 * Props:
 * - title (string): Button text
 * - onPress (function): Press handler
 * - loading (boolean, optional): When true, shows an ActivityIndicator and ignores presses
 * - disabled (boolean, optional): When true, dims button and ignores presses
 * - variant (string, optional): 'primary' (default), 'secondary', or 'danger'
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}) {
  const isDisabled = disabled || loading;

  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const buttonVariantStyle = isSecondary
    ? styles.buttonSecondary
    : isDanger
    ? styles.buttonDanger
    : styles.buttonPrimary;

  const textVariantStyle = isSecondary
    ? styles.textSecondary
    : styles.textPrimary;

  const spinnerColor = isSecondary ? colors.primary : colors.white;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        buttonVariantStyle,
        isDisabled ? styles.buttonDisabled : null,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={[styles.buttonText, textVariantStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  textPrimary: {
    color: colors.white,
  },
  textSecondary: {
    color: colors.primary,
  },
});
