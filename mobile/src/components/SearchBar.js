/**
 * SearchBar.js
 * Standardized search input with search icon and clear (×) button.
 *
 * Props:
 * - value (string): current search text
 * - onChangeText (function): callback with updated text
 * - onClear (function, optional): callback on clear (defaults to onChangeText(''))
 * - placeholder (string, optional)
 * - autoCapitalize (string, optional, default: 'none')
 * - containerStyle (object, optional)
 */

import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

export default function SearchBar({
  value = '',
  onChangeText,
  onClear,
  placeholder = 'Search...',
  autoCapitalize = 'none',
  containerStyle,
}) {
  const handleClear = () => {
    if (typeof onClear === 'function') {
      onClear();
    } else if (typeof onChangeText === 'function') {
      onChangeText('');
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons
        name="search-outline"
        size={18}
        color={colors.muted}
        style={styles.icon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        clearButtonMode="never"
        accessibilityLabel={placeholder}
      />
      {value ? (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    height: 42,
  },
  icon: {
    marginRight: spacing.xs + 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
