/**
 * AssetFormScreen.js
 * Form screen for creating and editing Gram Panchayat water supply assets.
 * Supports add and edit modes, type-specific dynamic attributes, date pickers,
 * client-side validations, dirty-state unsaved changes guard, and partial updates.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Linking,
  Modal,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ChipSelector from '../components/ChipSelector';
import DateField from '../components/DateField';
import EmptyState from '../components/EmptyState';
import {
  ATTRIBUTE_FIELDS,
  emptyForm,
  assetToForm,
  validateForm,
  buildCreatePayload,
  buildUpdatePayload,
} from '../utils/assetFormUtil';
import { pickAndCompressPhoto, uploadToCloudinary } from '../utils/photoHelper';
import { todayString } from '../utils/dateUtil';
import { ASSET_TYPES, ASSET_STATUSES, typeLabel } from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, spacing, radius } from '../theme';

function hasUnsavedChanges(form, base) {
  if (!base) return false;
  if ((form.name || '').trim() !== (base.name || '').trim()) return true;
  if (form.type !== base.type) return true;
  if (form.status !== base.status) return true;
  if (form.installDate !== base.installDate) return true;
  if (form.warrantyExpiry !== base.warrantyExpiry) return true;
  if ((form.lat || '').trim() !== (base.lat || '').trim()) return true;
  if ((form.lng || '').trim() !== (base.lng || '').trim()) return true;
  if ((form.cost || '').trim() !== (base.cost || '').trim()) return true;
  if ((form.notes || '').trim() !== (base.notes || '').trim()) return true;
  if ((form.statusNote || '').trim() !== (base.statusNote || '').trim()) return true;
  if ((form.photoUrl || '').trim() !== (base.photoUrl || '').trim()) return true;

  const currentAttrs = form.attributes || {};
  const baseAttrs = base.attributes || {};
  const allKeys = new Set([...Object.keys(currentAttrs), ...Object.keys(baseAttrs)]);
  for (const k of allKeys) {
    if ((currentAttrs[k] || '').trim() !== (baseAttrs[k] || '').trim()) {
      return true;
    }
  }

  return false;
}

export default function AssetFormScreen({ route, navigation }) {
  const assetId = route?.params?.id;
  const isEdit = Boolean(assetId);

  // Form state & snapshots
  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(null);

  // UI & Loading states
  const [loadingAsset, setLoadingAsset] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Photo upload states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPreviewUri, setLocalPreviewUri] = useState(null);

  // Map picker modal state
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [loadingMapRegion, setLoadingMapRegion] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [selectedCoord, setSelectedCoord] = useState(null);

  // Errors & feedback
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Flag to disable unsaved-changes guard on successful submit
  const saveSuccessRef = useRef(false);

  // Set navigation header title
  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? strings.editAssetTitle : strings.addAssetTitle,
    });
  }, [navigation, isEdit]);

  // Load existing asset in edit mode
  const loadExistingAsset = async () => {
    setLoadingAsset(true);
    setLoadError('');
    setNotFound(false);
    try {
      const response = await apiClient.get(`/assets/${assetId}`);
      const asset = response.data?.asset;
      if (!asset) {
        setNotFound(true);
        return;
      }
      const initialData = assetToForm(asset);
      setForm(initialData);
      setOriginal(initialData);
    } catch (err) {
      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(getErrorMessage(err));
      }
    } finally {
      setLoadingAsset(false);
    }
  };

  useEffect(() => {
    if (isEdit) {
      loadExistingAsset();
    }
  }, [assetId]);

  // Unsaved changes guard
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (saveSuccessRef.current) {
        return;
      }

      const base = isEdit ? original : emptyForm();
      if (!base) return;

      if (!hasUnsavedChanges(form, base)) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        strings.discardChangesTitle,
        strings.discardChangesMessage,
        [
          { text: strings.keepEditing, style: 'cancel' },
          {
            text: strings.discard,
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, form, original, isEdit]);

  // Field change helpers
  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSubmitError('');
    setInfoMessage('');
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const updateCoords = (latStr, lngStr) => {
    setForm((prev) => ({ ...prev, lat: latStr, lng: lngStr }));
    setSubmitError('');
    setInfoMessage('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.lat;
      delete next.lng;
      return next;
    });
  };

  const handleUseMyLocation = async () => {
    if (gettingLocation) return;
    setGettingLocation(true);

    try {
      // 1. Check if device location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          strings.locationServicesDisabledTitle,
          strings.locationServicesDisabledMessage,
          [{ text: strings.ok }]
        );
        return;
      }

      // 2. Request foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          strings.locationPermissionTitle,
          strings.locationPermissionMessage,
          [
            { text: strings.cancel, style: 'cancel' },
            {
              text: strings.openSettings,
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
          ]
        );
        return;
      }

      // 3. Fetch current GPS position with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (location?.coords) {
        const { latitude, longitude } = location.coords;
        const latStr = latitude.toFixed(6);
        const lngStr = longitude.toFixed(6);
        updateCoords(latStr, lngStr);
      } else {
        throw new Error('No coordinates returned');
      }
    } catch (err) {
      Alert.alert(
        strings.locationErrorTitle,
        strings.locationErrorMessage,
        [{ text: strings.ok }]
      );
    } finally {
      setGettingLocation(false);
    }
  };

  // Map picker handlers
  const handleOpenMapPicker = async () => {
    // 1. Check if form already has valid coordinates
    const latNum = Number(String(form.lat).trim().replace(',', '.'));
    const lngNum = Number(String(form.lng).trim().replace(',', '.'));
    const hasValidCoords =
      String(form.lat).trim() !== '' &&
      String(form.lng).trim() !== '' &&
      !isNaN(latNum) &&
      latNum >= -90 &&
      latNum <= 90 &&
      !isNaN(lngNum) &&
      lngNum >= -180 &&
      lngNum <= 180;

    if (hasValidCoords) {
      setMapRegion({
        latitude: latNum,
        longitude: lngNum,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      setSelectedCoord({
        latitude: latNum,
        longitude: lngNum,
      });
      setMapModalVisible(true);
      return;
    }

    // 2. Open modal and fetch current GPS position or fallback to central India
    setSelectedCoord(null);
    setLoadingMapRegion(true);
    setMapModalVisible(true);

    let region = {
      latitude: 20.5937,
      longitude: 78.9629,
      latitudeDelta: 8.0,
      longitudeDelta: 8.0,
    };

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (location?.coords) {
          region = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          };
        }
      }
    } catch {
      // Ignore errors, default fallback region will be used
    } finally {
      setMapRegion(region);
      setLoadingMapRegion(false);
    }
  };

  const handleConfirmMapCoord = () => {
    if (!selectedCoord) return;
    const latStr = selectedCoord.latitude.toFixed(6);
    const lngStr = selectedCoord.longitude.toFixed(6);
    updateCoords(latStr, lngStr);
    setMapModalVisible(false);
  };

  const handleCancelMapCoord = () => {
    setMapModalVisible(false);
  };

  const handleTypeChange = (newType) => {
    setForm((prev) => ({
      ...prev,
      type: newType,
      attributes: {}, // Reset attributes on type change
    }));
    setSubmitError('');
    setInfoMessage('');
    if (errors.type) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.type;
        return next;
      });
    }
  };

  const updateAttribute = (attrKey, value) => {
    setForm((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attrKey]: value,
      },
    }));
    setSubmitError('');
    setInfoMessage('');
    if (errors.attributes && errors.attributes[attrKey]) {
      setErrors((prev) => {
        const nextAttrs = { ...prev.attributes };
        delete nextAttrs[attrKey];
        return { ...prev, attributes: nextAttrs };
      });
    }
  };

  // Photo handlers
  const performUpload = async (uri) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const secureUrl = await uploadToCloudinary(uri, (progress) => {
        setUploadProgress(progress);
      });
      setForm((prev) => ({ ...prev, photoUrl: secureUrl }));
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
    setUploadProgress(0);
    setForm((prev) => ({ ...prev, photoUrl: '' }));
  };

  // Submit handler
  const handleSave = async () => {
    if (submitting) return;

    setSubmitError('');
    setInfoMessage('');

    const { valid, errors: validationErrors } = validateForm(form, {
      mode: isEdit ? 'edit' : 'add',
      today: todayString(),
    });

    if (!valid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    if (isEdit) {
      const payload = buildUpdatePayload(form, original);
      if (Object.keys(payload).length === 0) {
        setInfoMessage(strings.noChangesToSave);
        return;
      }

      setSubmitting(true);
      try {
        await apiClient.patch(`/assets/${assetId}`, payload);
        saveSuccessRef.current = true;
        navigation.goBack();
      } catch (err) {
        if (err?.response?.status === 401) {
          useAuthStore.getState().logout();
          return;
        }
        setSubmitError(getErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
    } else {
      const payload = buildCreatePayload(form);
      setSubmitting(true);
      try {
        await apiClient.post('/assets', payload);
        saveSuccessRef.current = true;
        navigation.goBack();
      } catch (err) {
        if (err?.response?.status === 401) {
          useAuthStore.getState().logout();
          return;
        }
        setSubmitError(getErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Loading state in edit mode
  if (loadingAsset) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 404 Not Found state
  if (notFound) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message={strings.assetNotFound}
          actionLabel={strings.goBack}
          onAction={() => navigation.goBack()}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  // Fetch load error state
  if (loadError) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message={loadError}
          actionLabel={strings.retry}
          onAction={loadExistingAsset}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  const typeFields = ATTRIBUTE_FIELDS[form.type] || [];
  const showStatusNote = isEdit && form.status !== original?.status;
  const hasValidationErrors =
    Object.keys(errors).filter((k) => k !== 'attributes').length > 0 ||
    Object.keys(errors.attributes || {}).length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Name */}
        <FormField
          label={strings.assetNameLabel}
          placeholder={strings.assetNamePlaceholder}
          value={form.name}
          onChangeText={(text) => updateField('name', text)}
          required={true}
          error={errors.name ? strings[errors.name] : undefined}
        />

        {/* Photo Section */}
        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>{strings.photoLabel}</Text>
          {localPreviewUri || form.photoUrl ? (
            <View style={styles.photoPreviewRow}>
              <View style={styles.photoThumbnailContainer}>
                <Image
                  source={{ uri: localPreviewUri || form.photoUrl }}
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
                size={28}
                color={colors.primary}
              />
              <Text style={styles.photoPickerPlaceholderText}>
                {strings.addPhoto}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. Type */}
        {isEdit ? (
          <View style={styles.readOnlyContainer}>
            <Text style={styles.readOnlyLabel}>{strings.typeLabel}</Text>
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyText}>{typeLabel(form.type)}</Text>
            </View>
            <Text style={styles.hintText}>{strings.typeCannotBeChanged}</Text>
          </View>
        ) : (
          <View style={styles.sectionMargin}>
            <ChipSelector
              label={strings.typeLabel}
              options={ASSET_TYPES}
              value={form.type}
              onChange={handleTypeChange}
              scrollable={false}
              allowDeselect={false}
              error={errors.type ? strings[errors.type] : undefined}
            />
          </View>
        )}

        {/* 3. Status */}
        <View style={styles.sectionMargin}>
          <ChipSelector
            label={strings.statusLabel}
            options={ASSET_STATUSES}
            value={form.status}
            onChange={(val) => updateField('status', val)}
            scrollable={false}
            allowDeselect={false}
          />
        </View>

        {/* 4. Install Date */}
        <DateField
          label={strings.installDateLabel}
          value={form.installDate}
          onChange={(val) => updateField('installDate', val)}
          maximumDate={todayString()}
          error={errors.installDate ? strings[errors.installDate] : undefined}
        />

        {/* 5. Type-Specific Attributes Section */}
        {typeFields.length > 0 ? (
          <View style={styles.attributesSection}>
            {typeFields.map((field) => (
              <FormField
                key={field.key}
                label={strings[field.label]}
                value={form.attributes[field.key] || ''}
                onChangeText={(text) => updateAttribute(field.key, text)}
                keyboardType={field.kind === 'number' ? 'decimal-pad' : 'default'}
                error={
                  errors.attributes && errors.attributes[field.key]
                    ? strings[errors.attributes[field.key]]
                    : undefined
                }
              />
            ))}
          </View>
        ) : null}

        {/* 6. Location: Latitude and Longitude */}
        <View style={styles.locationContainer}>
          <View style={styles.locationButtonsRow}>
            <TouchableOpacity
              style={[
                styles.useLocationButton,
                gettingLocation ? styles.useLocationButtonDisabled : null,
              ]}
              onPress={handleUseMyLocation}
              disabled={gettingLocation}
              accessibilityRole="button"
              accessibilityLabel={
                gettingLocation
                  ? strings.gettingLocation
                  : strings.useMyLocation
              }
              accessibilityState={{
                disabled: gettingLocation,
                busy: gettingLocation,
              }}
              activeOpacity={0.7}
            >
              {gettingLocation ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={styles.useLocationSpinner}
                  />
                  <Text style={styles.useLocationButtonText}>
                    {strings.gettingLocation}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.useLocationButtonText}>
                    {strings.useMyLocation}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickOnMapButton}
              onPress={handleOpenMapPicker}
              accessibilityRole="button"
              accessibilityLabel={strings.pickOnMap}
              activeOpacity={0.7}
            >
              <Ionicons
                name="map-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.pickOnMapButtonText}>
                {strings.pickOnMap}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.coordsRow}>
            <View style={styles.coordField}>
              <FormField
                label={strings.latLabel}
                placeholder={strings.latPlaceholder}
                value={form.lat}
                onChangeText={(text) => updateField('lat', text)}
                keyboardType={
                  Platform.OS === 'ios'
                    ? 'numbers-and-punctuation'
                    : 'decimal-pad'
                }
                error={errors.lat ? strings[errors.lat] : undefined}
              />
            </View>
            <View style={styles.coordField}>
              <FormField
                label={strings.lngLabel}
                placeholder={strings.lngPlaceholder}
                value={form.lng}
                onChangeText={(text) => updateField('lng', text)}
                keyboardType={
                  Platform.OS === 'ios'
                    ? 'numbers-and-punctuation'
                    : 'decimal-pad'
                }
                error={errors.lng ? strings[errors.lng] : undefined}
              />
            </View>
          </View>
          <Text style={styles.hintText}>{strings.locationHint}</Text>
        </View>

        {/* 7. Cost in rupees */}
        <FormField
          label={strings.costLabel}
          placeholder={strings.costPlaceholder}
          value={form.cost}
          onChangeText={(text) => updateField('cost', text)}
          keyboardType="decimal-pad"
          error={errors.cost ? strings[errors.cost] : undefined}
        />

        {/* 8. Warranty Expiry */}
        <DateField
          label={strings.warrantyExpiryLabel}
          value={form.warrantyExpiry}
          onChange={(val) => updateField('warrantyExpiry', val)}
        />

        {/* 9. Notes */}
        <FormField
          label={strings.notesLabel}
          placeholder={strings.notesPlaceholder}
          value={form.notes}
          onChangeText={(text) => updateField('notes', text)}
          multiline={true}
          error={errors.notes ? strings[errors.notes] : undefined}
        />

        {/* 10. Reason for status change (in edit mode only, if status changed) */}
        {showStatusNote ? (
          <FormField
            label={strings.statusNoteLabel}
            placeholder={strings.statusNotePlaceholder}
            value={form.statusNote}
            onChangeText={(text) => updateField('statusNote', text)}
            multiline={true}
            error={errors.statusNote ? strings[errors.statusNote] : undefined}
          />
        ) : null}

        {/* Feedback messages */}
        {hasValidationErrors ? (
          <Text style={styles.errorBannerText}>{strings.fixHighlightedErrors}</Text>
        ) : null}

        {submitError ? (
          <Text style={styles.errorBannerText}>{submitError}</Text>
        ) : null}

        {infoMessage ? (
          <Text style={styles.infoBannerText}>{infoMessage}</Text>
        ) : null}

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={strings.save}
            onPress={handleSave}
            loading={submitting}
            disabled={submitting || uploading}
          />
        </View>
      </ScrollView>

      {/* Map Location Picker Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        onRequestClose={handleCancelMapCoord}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{strings.pickOnMapTitle}</Text>
            <TouchableOpacity
              onPress={handleCancelMapCoord}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel={strings.cancel}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Map Area */}
          <View style={styles.mapWrapper}>
            {loadingMapRegion ? (
              <View style={styles.mapLoadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.mapLoadingText}>{strings.loadingMap}</Text>
              </View>
            ) : mapRegion ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                initialRegion={mapRegion}
                onPress={(e) => {
                  if (e?.nativeEvent?.coordinate) {
                    setSelectedCoord(e.nativeEvent.coordinate);
                  }
                }}
              >
                {selectedCoord ? (
                  <Marker
                    coordinate={selectedCoord}
                    draggable
                    onDragEnd={(e) => {
                      if (e?.nativeEvent?.coordinate) {
                        setSelectedCoord(e.nativeEvent.coordinate);
                      }
                    }}
                  />
                ) : null}
              </MapView>
            ) : null}
          </View>

          {/* Bottom Card */}
          <View style={styles.modalBottomCard}>
            <View style={styles.selectedCoordsInfo}>
              {selectedCoord ? (
                <>
                  <Text style={styles.selectedCoordsText}>
                    {strings.selectedCoordinates
                      .replace('{lat}', selectedCoord.latitude.toFixed(6))
                      .replace('{lng}', selectedCoord.longitude.toFixed(6))}
                  </Text>
                  <Text style={styles.dragPinHintText}>
                    {strings.dragPinHint}
                  </Text>
                </>
              ) : (
                <Text style={styles.tapToPlacePinText}>
                  {strings.tapToPlacePin}
                </Text>
              )}
            </View>

            <View style={styles.modalActionsRow}>
              <View style={styles.modalActionCol}>
                <PrimaryButton
                  title={strings.cancel}
                  variant="secondary"
                  onPress={handleCancelMapCoord}
                />
              </View>
              <View style={styles.modalActionCol}>
                <PrimaryButton
                  title={strings.confirmLocation}
                  variant="primary"
                  onPress={handleConfirmMapCoord}
                  disabled={!selectedCoord}
                />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  sectionMargin: {
    marginBottom: spacing.xs,
  },
  readOnlyContainer: {
    marginBottom: spacing.lg,
  },
  readOnlyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  readOnlyBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  attributesSection: {
    marginBottom: spacing.sm,
  },
  locationContainer: {
    marginBottom: spacing.lg,
  },
  locationButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  useLocationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  useLocationButtonDisabled: {
    opacity: 0.6,
    borderColor: colors.border,
  },
  useLocationButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  useLocationSpinner: {
    marginRight: spacing.xs,
  },
  pickOnMapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  pickOnMapButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.muted,
  },
  modalBottomCard: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
  },
  selectedCoordsInfo: {
    marginBottom: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  selectedCoordsText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  dragPinHintText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  tapToPlacePinText: {
    fontSize: 14,
    color: colors.muted,
    fontStyle: 'italic',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalActionCol: {
    flex: 1,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coordField: {
    flex: 1,
  },
  hintText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoBannerText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  buttonContainer: {
    marginTop: spacing.md,
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
    width: 120,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  photoThumbnail: {
    width: 120,
    height: 120,
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
    fontSize: 11,
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
    minHeight: 40,
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
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPickerPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.xs,
  },
});
