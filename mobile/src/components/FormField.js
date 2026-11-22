/**
 * FormField.js
 * A reusable labeled input field supporting error states, helper hints,
 * required indicator, multiline input, and accessibility integration.
 *
 * Props:
 * - label (string, optional): Input label displayed above the field
 * - value (string): Current text value of the input
 * - onChangeText (function): Callback when input text changes
 * - error (string, optional): Error message shown below input (turns border red)
 * - hint (string, optional): Helper text shown below input when there is no error
 * - required (boolean, optional): Displays a red asterisk next to the label
 * - multiline (boolean, optional): Enables multiline mode with top-aligned text and taller input
 * - ...textInputProps: Passed directly through to React Native TextInput
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

export default function FormField({
  label,
  value,
  onChangeText,
  error,
  hint,
  required,
  multiline,
  style,
  ...textInputProps
}) {
  const accessibilityText = label
    ? `${label}${required ? ', required' : ''}`
    : textInputProps.placeholder || '';

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
        </Text>
      ) : null}

      <TextInput
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          error ? styles.inputError : null,
          style,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={accessibilityText}
        accessibilityHint={hint}
        accessibilityInvalid={!!error}
        {...textInputProps}
      />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: spacing.sm + 4,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  hintText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
