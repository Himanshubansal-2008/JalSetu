/**
 * TimelineItem.js
 * A single timeline history row with colored dot, vertical connector line,
 * event kind badge, note, and author/date metadata.
 *
 * Props:
 * - title (string): Event title / kind label
 * - tone (string): Status tone for the dot and badge ('warning', 'danger', 'neutral', etc.)
 * - note (string, optional): Additional note about the event
 * - meta (string): Footer line containing author and formatted date/time
 * - isLast (boolean, optional): If true, hides the vertical connector line
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StatusBadge from './StatusBadge';
import { colors, tones, spacing } from '../theme';

export default function TimelineItem({
  title,
  tone = 'neutral',
  note,
  meta,
  isLast = false,
}) {
  const currentTone = tones[tone] || tones.neutral;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={[title, note, meta].filter(Boolean).join(', ')}
    >
      {/* Left indicator: dot and vertical connector */}
      <View style={styles.leftColumn}>
        <View style={[styles.dot, { backgroundColor: currentTone.fg }]} />
        {!isLast ? <View style={styles.line} /> : null}
      </View>

      {/* Right content */}
      <View style={[styles.rightContent, !isLast ? styles.contentWithLine : null]}>
        <View style={styles.headerRow}>
          <StatusBadge label={title} tone={tone} />
        </View>

        {note ? <Text style={styles.note}>{note}</Text> : null}

        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  leftColumn: {
    alignItems: 'center',
    width: 20,
    marginRight: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  rightContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  contentWithLine: {
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  note: {
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.xs + 2,
  },
});
