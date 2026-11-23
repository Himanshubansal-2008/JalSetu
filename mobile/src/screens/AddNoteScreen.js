/**
 * AddNoteScreen.js
 * Form screen for creating an asset history event / note (Repair, Inspection, Note)
 * with optional photo attachment via Cloudinary.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import ChipSelector from '../components/ChipSelector';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { pickAndCompressPhoto, uploadToCloudinary } from '../utils/photoHelper';
import { strings } from '../strings';
import { colors, spacing, radius } from '../theme';

const EVENT_KIND_OPTIONS = [
  { value: 'Note', label: strings.eventNote },
  { value: 'Inspection', label: strings.eventInspection },
  { value: 'Repair', label: strings.eventRepair },
];

export default function AddNoteScreen({ route, navigation }) {
  const assetId = route?.params?.assetId || route?.params?.id;
  const assetName = route?.params?.assetName || route?.params?.name;

  // Form states
  const [kind, setKind] = useState('Note');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  // Photo states
  const [photoUrl, setPhotoUrl] = useState('');
  const [localPreviewUri, setLocalPreviewUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    navigation.setOptions({
      title: assetName
        ? `${strings.addNoteTitle} · ${assetName}`
        : strings.addNoteTitle,
    });
  }, [navigation, assetName]);

  const handleNoteChange = (text) => {
    setNote(text);
    if (noteError) setNoteError('');
    if (submitError) setSubmitError('');
  };

  const performUpload = async (uri) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const secureUrl = await uploadToCloudinary(uri, (progress) => {
        setUploadProgress(progress);
      });
      setPhotoUrl(secureUrl);
      setUploading(false);
    } catch (err) {
      setUploading(false);
      Alert.alert(
        strings.uploadFailedTitle,
        strings.uploadFailedMessage,
        [
          { text: strings.cancel, style: 'cancel' },
          {
            text: strings.retry,
            onPress: () => performUpload(uri),
          },
        ]
      );
    }
  };

  const handlePickPhoto = async () => {
    if (uploading) return;
    try {
      const photo = await pickAndCompressPhoto();
      if (!photo || !photo.uri) return;

      setLocalPreviewUri(photo.uri);
      await performUpload(photo.uri);
    } catch (err) {
      Alert.alert(strings.uploadFailedTitle, getErrorMessage(err));
    }
  };

  const handleRemovePhoto = () => {
    if (uploading) return;
    setLocalPreviewUri(null);
    setPhotoUrl('');
    setUploadProgress(0);
  };

  const handleSubmit = async () => {
    if (submitting || uploading) return;

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setNoteError(strings.errNoteRequired);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await apiClient.post(`/assets/${assetId}/events`, {
        kind,
        note: trimmedNote,
        photoUrl: photoUrl || null,
      });

      navigation.goBack();
    } catch (err) {
      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }
      const msg = getErrorMessage(err);
      setSubmitError(msg);
      Alert.alert(strings.addNoteTitle, msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Event Kind Selector */}
        <View style={styles.sectionMargin}>
          <ChipSelector
            label={strings.eventKindLabel}
            options={EVENT_KIND_OPTIONS}
            value={kind}
            onChange={(val) => {
              if (val) setKind(val);
            }}
            scrollable={false}
            allowDeselect={false}
          />
        </View>

        {/* Note Multi-line Input */}
        <FormField
          label={strings.eventNoteLabel}
          placeholder={strings.eventNotePlaceholder}
          value={note}
          onChangeText={handleNoteChange}
          multiline={true}
          numberOfLines={4}
          required={true}
          maxLength={2000}
          error={noteError}
          style={styles.noteInput}
        />

        {/* Optional Photo Section */}
        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>{strings.attachPhotoOptional}</Text>
          {localPreviewUri || photoUrl ? (
            <View style={styles.photoPreviewRow}>
              <View style={styles.photoThumbnailContainer}>
                <Image
                  source={{ uri: localPreviewUri || photoUrl }}
                  style={styles.photoThumbnail}
                />
                {uploading ? (
                  <View style={styles.photoUploadingOverlay}>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={styles.photoUploadingText}>
                      {strings.uploadingPhoto.replace(
                        '{progress}',
                        String(uploadProgress)
                      )}
                    </Text>
                    <View style={styles.photoProgressBarBg}>
                      <View
                        style={[
                          styles.photoProgressBarFill,
                          { width: `${uploadProgress}%` },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.photoActionsCol}>
                <TouchableOpacity
                  style={[
                    styles.photoActionButton,
                    uploading ? styles.photoActionButtonDisabled : null,
                  ]}
                  onPress={handlePickPhoto}
                  disabled={uploading}
                  accessibilityRole="button"
                  accessibilityLabel={strings.changePhoto}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="camera-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.photoActionText}>
                    {strings.changePhoto}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.photoActionButton,
                    styles.photoRemoveButton,
                    uploading ? styles.photoActionButtonDisabled : null,
                  ]}
                  onPress={handleRemovePhoto}
                  disabled={uploading}
                  accessibilityRole="button"
                  accessibilityLabel={strings.removePhoto}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={colors.danger}
                  />
                  <Text
                    style={[styles.photoActionText, { color: colors.danger }]}
                  >
                    {strings.removePhoto}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoPickerPlaceholder}
              onPress={handlePickPhoto}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={strings.addPhoto}
              activeOpacity={0.7}
            >
              <Ionicons
                name="camera-outline"
                size={26}
                color={colors.primary}
              />
              <Text style={styles.photoPickerPlaceholderText}>
                {strings.addPhoto}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit Error */}
        {submitError ? (
          <Text style={styles.errorBannerText}>{submitError}</Text>
        ) : null}

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={strings.saveNote}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || uploading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  sectionMargin: {
    marginBottom: spacing.md,
  },
  noteInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  photoSection: {
    marginBottom: spacing.lg,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoThumbnailContainer: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  photoThumbnail: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  photoUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  photoUploadingText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  photoProgressBarBg: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  photoProgressBarFill: {
    height: '100%',
    backgroundColor: colors.white,
  },
  photoActionsCol: {
    flex: 1,
    gap: spacing.sm,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    minHeight: 38,
  },
  photoRemoveButton: {
    borderColor: colors.danger,
  },
  photoActionButtonDisabled: {
    opacity: 0.5,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  photoPickerPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    backgroundColor: colors.white,
    height: 84,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPickerPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.xs,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
