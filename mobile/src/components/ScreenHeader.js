/**
 * ScreenHeader.js
 * Standardized screen header component with title, subtitle, optional back button,
 * and optional right action element.
 *
 * Props:
 * - title (string): Screen title
 * - subtitle (string, optional): Secondary subtitle text
 * - onBack (function, optional): When provided, renders back chevron button
 * - rightAction (node, optional): Action button or icons on right
 * - containerStyle (object, optional)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  containerStyle,
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.leftRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginLeft: -spacing.xs,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  rightAction: {
    marginLeft: spacing.sm,
  },
});
