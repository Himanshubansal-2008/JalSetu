/**
 * ListCard.js
 * A tappable card component for list items across Assets, Inventory, Finance, and Consumers.
 *
 * Props:
 * - title (string): Primary card heading (truncated if too long)
 * - subtitle (string, optional): Secondary descriptive text (up to 2 lines)
 * - meta (string, optional): Smaller muted tertiary line
 * - badge (object, optional): { label: string, tone: string } rendered with StatusBadge
 * - icon (string, optional): Ionicons icon name shown in a round tinted circle on the left
 * - onPress (function, optional): Press handler. Shows right chevron when provided.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { colors, tones, spacing, radius } from '../theme';

export default function ListCard({
  title,
  subtitle,
  meta,
  badge,
  icon,
  onPress,
}) {
  const isPressable = typeof onPress === 'function';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isPressable && pressed ? styles.cardPressed : null,
      ]}
      onPress={onPress}
      disabled={!isPressable}
      accessibilityRole={isPressable ? 'button' : 'none'}
      accessibilityLabel={[title, subtitle, meta, badge?.label]
        .filter(Boolean)
        .join(', ')}
      accessibilityState={{ disabled: !isPressable }}
    >
      {icon ? (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
            {meta}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightSection}>
        {badge ? (
          <StatusBadge label={badge.label} tone={badge.tone} />
        ) : null}
        {isPressable ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.muted}
            style={styles.chevron}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 44,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm + 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: colors.pressed,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tones.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
