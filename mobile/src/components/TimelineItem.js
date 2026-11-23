/**
 * TimelineItem.js
 * A single timeline history row with colored dot, vertical connector line,
 * event kind badge, clean date/time, full note body, optional tappable photo with
 * full-screen preview modal, and author attribution.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { colors, tones, spacing, radius } from '../theme';
import { strings } from '../strings';

export default function TimelineItem({
  title,
  tone = 'neutral',
  dateTime,
  note,
  author,
  photoUrl,
  isLast = false,
}) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const currentTone = tones[tone] || tones.neutral;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={[title, dateTime, note, author ? `by ${author}` : '']
        .filter(Boolean)
        .join(', ')}
    >
      {/* Left indicator: dot and vertical connector */}
      <View style={styles.leftColumn}>
        <View style={[styles.dot, { backgroundColor: currentTone.fg }]} />
        {!isLast ? <View style={styles.line} /> : null}
      </View>

      {/* Right Content: Card */}
      <View style={[styles.card, !isLast ? styles.cardWithSpacing : null]}>
        {/* Header Row: Kind badge on left, clean date/time on right */}
        <View style={styles.headerRow}>
          <StatusBadge label={title} tone={tone} />
          {dateTime ? (
            <Text style={styles.dateTimeText}>{dateTime}</Text>
          ) : null}
        </View>

        {/* Body Text */}
        {note ? <Text style={styles.note}>{note}</Text> : null}

        {/* Optional Attached Photo */}
        {photoUrl ? (
          <TouchableOpacity
            style={styles.photoThumbnailWrapper}
            onPress={() => setPreviewVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="imagebutton"
            accessibilityLabel={strings.viewPhoto}
          >
            <Image
              source={{ uri: photoUrl }}
              style={styles.photoThumbnail}
              resizeMode="cover"
            />
            <View style={styles.photoZoomIcon}>
              <Ionicons name="expand-outline" size={12} color={colors.white} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Author Attribution */}
        {author ? (
          <Text style={styles.authorText}>
            {strings.byAuthor
              ? strings.byAuthor.replace('{name}', author)
              : `by ${author}`}
          </Text>
        ) : null}
      </View>

      {/* Full-screen Photo Preview Modal */}
      {photoUrl ? (
        <Modal
          visible={previewVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <SafeAreaView style={styles.modalOverlay}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setPreviewVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={strings.cancel}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={28} color={colors.white} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalImageWrapper}>
              <Image
                source={{ uri: photoUrl }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
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
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 14,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
    marginBottom: -spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardWithSpacing: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dateTimeText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
  },
  note: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  photoThumbnailWrapper: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoZoomIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: colors.overlay,
    borderRadius: radius.sm,
    padding: 3,
  },
  authorText: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  modalCloseButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});
