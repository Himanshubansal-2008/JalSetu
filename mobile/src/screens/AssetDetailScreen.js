/**
 * AssetDetailScreen.js
 * Screen displaying full asset details, specifications, notes, history timeline,
 * an edit button for all users, and an admin-only delete button with confirmation.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import PrimaryButton from '../components/PrimaryButton';
import StatusBadge from '../components/StatusBadge';
import DetailRow from '../components/DetailRow';
import TimelineItem from '../components/TimelineItem';
import EmptyState from '../components/EmptyState';
import {
  statusTone,
  typeIcon,
  typeLabel,
  statusLabel,
  eventKindLabelKey,
  eventKindTone,
  formatEventNote,
  getMarkerColor,
} from '../utils/assetUtil';
import { ATTRIBUTE_FIELDS } from '../utils/assetFormUtil';
import { formatRupees } from '../utils/moneyUtil';
import {
  formatDisplay,
  formatDateTime,
  isoToDateString,
  isPast,
} from '../utils/dateUtil';
import { strings } from '../strings';
import { colors, spacing, radius, tones } from '../theme';

function formatAttributeValue(key, val) {
  if (val === undefined || val === null || val === '') return '';
  const strVal = typeof val === 'number' ? val.toLocaleString() : String(val);
  switch (key) {
    case 'hp':
      return `${strVal} ${strings.unitHp}`;
    case 'capacityL':
      return `${strVal} ${strings.unitLiter}`;
    case 'lengthM':
    case 'depthM':
      return `${strVal} ${strings.unitMeter}`;
    case 'diameterMm':
      return `${strVal} ${strings.unitMm}`;
    case 'capacityLPD':
      return `${strVal} ${strings.unitLpd}`;
    default:
      return strVal;
  }
}

export default function AssetDetailScreen({ route, navigation }) {
  const { id, name: initialName } = route?.params || {};

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  // Data & loading states
  const [asset, setAsset] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialError, setInitialError] = useState('');
  const [reloadError, setReloadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [heroImageLoading, setHeroImageLoading] = useState(false);

  // Tracking refs
  const hasDataRef = useRef(false);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const isDeletingRef = useRef(false);
  const deletedRef = useRef(false);

  // Set initial title from route params
  useEffect(() => {
    navigation.setOptions({
      title: initialName || strings.assetDetailTitle,
    });
  }, [navigation, initialName]);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch asset data from backend
  const fetchAsset = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (deletedRef.current) return;

      const currentReqId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setInitialLoading(true);
      }
      setReloadError('');

      try {
        const response = await apiClient.get(`/assets/${id}`);
        if (
          !isMountedRef.current ||
          currentReqId !== requestIdRef.current ||
          deletedRef.current
        ) {
          return;
        }

        const data = response.data?.asset;
        if (!data) {
          setNotFound(true);
          return;
        }

        setAsset(data);
        hasDataRef.current = true;
        setNotFound(false);
        setInitialError('');
        navigation.setOptions({ title: data.name || strings.assetDetailTitle });
      } catch (err) {
        if (
          !isMountedRef.current ||
          currentReqId !== requestIdRef.current ||
          deletedRef.current
        ) {
          return;
        }

        if (err?.response?.status === 401) {
          useAuthStore.getState().logout();
          return;
        }
        if (err?.response?.status === 404) {
          setNotFound(true);
          return;
        }

        const msg = getErrorMessage(err);
        if (!hasDataRef.current) {
          setInitialError(msg);
        } else {
          setReloadError(msg);
        }
      } finally {
        if (isMountedRef.current && currentReqId === requestIdRef.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id, navigation]
  );

  // Focus effect: fetch on first focus and refocus (e.g. after editing)
  useFocusEffect(
    useCallback(() => {
      if (!deletedRef.current) {
        fetchAsset();
      }
    }, [fetchAsset])
  );

  const handleRefresh = () => {
    fetchAsset({ isRefresh: true });
  };

  // Delete handling
  const handleDeletePress = () => {
    if (deleting || isDeletingRef.current) return;

    Alert.alert(
      strings.deleteAssetConfirmTitle,
      strings.deleteAssetConfirmMessage.replace(
        '{name}',
        asset?.name || initialName || ''
      ),
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.delete,
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  };

  const performDelete = async () => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    setDeleting(true);

    try {
      await apiClient.delete(`/assets/${id}`);
      deletedRef.current = true;
      navigation.goBack();
    } catch (err) {
      isDeletingRef.current = false;
      setDeleting(false);

      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }
      if (err?.response?.status === 404) {
        deletedRef.current = true;
        navigation.goBack();
        return;
      }
      if (err?.response?.status === 409) {
        const errorMsg = err.response.data?.error || strings.genericError;
        Alert.alert(strings.deleteAssetConfirmTitle, errorMsg, [
          { text: strings.ok },
        ]);
        return;
      }
      if (err?.response?.status === 403) {
        Alert.alert(
          strings.deleteAssetConfirmTitle,
          strings.onlyAdminCanDelete,
          [{ text: strings.ok }]
        );
        return;
      }
      Alert.alert(strings.deleteAssetConfirmTitle, getErrorMessage(err), [
        { text: strings.ok },
      ]);
    }
  };

  // Full initial loading spinner
  if (initialLoading && !hasDataRef.current && !initialError && !notFound) {
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

  // Initial load error state
  if (initialError && !hasDataRef.current) {
    return (
      <View style={styles.centered}>
        <EmptyState
          message={initialError}
          actionLabel={strings.retry}
          onAction={() => fetchAsset()}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  if (!asset) return null;

  // Process specifications section
  const typeFields = ATTRIBUTE_FIELDS[asset.type] || [];
  const validAttrEntries = typeFields
    .map((field) => {
      const rawVal = asset.attributes ? asset.attributes[field.key] : undefined;
      const formatted = formatAttributeValue(field.key, rawVal);
      return {
        key: field.key,
        label: strings[field.label] || field.key,
        value: formatted,
      };
    })
    .filter((entry) => Boolean(entry.value));

  const hasSpecifications = validAttrEntries.length > 0;

  // Process location
  const latNum = Number(asset.lat);
  const lngNum = Number(asset.lng);
  const hasValidCoords =
    asset.lat !== null &&
    asset.lat !== undefined &&
    asset.lng !== null &&
    asset.lng !== undefined &&
    !isNaN(latNum) &&
    !isNaN(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180;
  const locationText = hasValidCoords
    ? `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`
    : strings.emDash;

  const handleOpenGoogleMaps = async () => {
    if (!hasValidCoords) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`;
    try {
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert(strings.mapsErrorTitle, strings.mapsErrorMessage);
    }
  };

  // Process dates
  const installDateStr = asset.installDate
    ? isoToDateString(asset.installDate)
    : '';
  const installDateDisplay = installDateStr
    ? formatDisplay(installDateStr)
    : strings.emDash;

  const warrantyDateStr = asset.warrantyExpiry
    ? isoToDateString(asset.warrantyExpiry)
    : '';
  const warrantyDateDisplay = warrantyDateStr
    ? formatDisplay(warrantyDateStr)
    : strings.emDash;
  const isWarrantyExpired = warrantyDateStr ? isPast(warrantyDateStr) : false;

  const addedOnDateStr = asset.createdAt ? isoToDateString(asset.createdAt) : '';
  const addedOnDisplay = addedOnDateStr
    ? formatDisplay(addedOnDateStr)
    : strings.emDash;

  // Cost
  const costDisplay =
    asset.cost !== null && asset.cost !== undefined
      ? formatRupees(asset.cost)
      : strings.emDash;

  // History events sorted newest-first (createdAt descending)
  const rawEvents = asset.events || [];
  const events = [...rawEvents].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });
  const eventCount = events.length;

  const heroPhotoUrl = asset.photoUrl || asset.photo;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Dismissible reload error banner */}
      {reloadError ? (
        <View style={styles.reloadErrorBanner}>
          <Text style={styles.reloadErrorText} numberOfLines={2}>
            {reloadError}
          </Text>
          <TouchableOpacity
            onPress={() => setReloadError('')}
            accessibilityRole="button"
            accessibilityLabel={strings.dismiss}
            style={styles.dismissErrorButton}
          >
            <Ionicons name="close" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Hero / Banner Image */}
      {heroPhotoUrl ? (
        <View style={styles.heroImageContainer}>
          <Image
            source={{ uri: heroPhotoUrl }}
            style={styles.heroImage}
            resizeMode="cover"
            onLoadStart={() => setHeroImageLoading(true)}
            onLoadEnd={() => setHeroImageLoading(false)}
          />
          {heroImageLoading ? (
            <View style={styles.heroImagePlaceholder}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* a) Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.typeIconContainer}>
            <Ionicons
              name={typeIcon(asset.type)}
              size={32}
              color={colors.primary}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.assetName}>{asset.name}</Text>
            <Text style={styles.assetType}>{typeLabel(asset.type)}</Text>
            <View style={styles.badgeWrapper}>
              <StatusBadge
                label={statusLabel(asset.status)}
                tone={statusTone(asset.status)}
              />
            </View>
          </View>
        </View>

        {/* b) Action Row */}
        <View style={styles.actionRow}>
          <View style={styles.actionButtonWrapper}>
            <PrimaryButton
              title={strings.edit}
              onPress={() => navigation.navigate('AssetForm', { id: asset.id })}
              variant="secondary"
              disabled={deleting}
            />
          </View>

          {isAdmin ? (
            <View style={styles.actionButtonWrapper}>
              <PrimaryButton
                title={strings.delete}
                onPress={handleDeletePress}
                variant="danger"
                loading={deleting}
                disabled={deleting}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* c) Details Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{strings.detailsSection}</Text>
        <DetailRow
          label={strings.installDateLabel}
          value={installDateDisplay}
        />
        <DetailRow
          label={strings.warrantyExpiryLabel}
          value={warrantyDateDisplay}
          extra={
            isWarrantyExpired ? (
              <StatusBadge label={strings.expiredBadge} tone="danger" />
            ) : null
          }
        />
        <DetailRow label={strings.costLabel} value={costDisplay} />
        <DetailRow label={strings.locationLabel} value={locationText} />
        <DetailRow label={strings.addedOnLabel} value={addedOnDisplay} />
      </View>

      {/* d) Location Map Preview Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{strings.locationLabel}</Text>
        {hasValidCoords ? (
          <>
            <View style={styles.mapPreviewContainer}>
              <MapView
                style={styles.mapPreview}
                initialRegion={{
                  latitude: latNum,
                  longitude: lngNum,
                  latitudeDelta: 0.004,
                  longitudeDelta: 0.004,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: latNum, longitude: lngNum }}
                  pinColor={getMarkerColor(asset.status)}
                />
              </MapView>
            </View>
            <Text style={styles.coordinatesText}>
              {`${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`}
            </Text>
            <TouchableOpacity
              style={styles.openMapsButton}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={strings.openInGoogleMaps}
            >
              <Ionicons
                name="navigate-outline"
                size={18}
                color={colors.white}
              />
              <Text style={styles.openMapsButtonText}>
                {strings.openInGoogleMaps}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.mutedPlaceholderText}>
            {strings.locationNotRecorded}
          </Text>
        )}
      </View>

      {/* e) Specifications Section (only if attribute fields exist and at least one is filled) */}
      {hasSpecifications ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {strings.specificationsSection}
          </Text>
          {validAttrEntries.map((item) => (
            <DetailRow key={item.key} label={item.label} value={item.value} />
          ))}
        </View>
      ) : null}

      {/* e) Notes Section */}
      {asset.notes && asset.notes.trim() ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{strings.notesSection}</Text>
          <DetailRow
            label={strings.notesLabel}
            value={asset.notes.trim()}
            multiline={true}
          />
        </View>
      ) : null}

      {/* f) History Section */}
      <View style={styles.sectionCard}>
        <View style={styles.historySectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {eventCount > 0
              ? strings.historyCountTitle.replace('{count}', eventCount)
              : strings.historySection}
          </Text>
          <TouchableOpacity
            style={styles.addNoteHeaderButton}
            onPress={() =>
              navigation.navigate('AddNote', {
                assetId: asset.id,
                assetName: asset.name,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={strings.addNote}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addNoteHeaderButtonText}>{strings.addNote}</Text>
          </TouchableOpacity>
        </View>

        {eventCount === 0 ? (
          <Text style={styles.mutedPlaceholderText}>
            {strings.noHistoryYet}
          </Text>
        ) : (
          <View style={styles.timelineList}>
            {events.map((event, index) => {
              const eventKind = event.kind || 'NOTE';
              const eventDateStr = formatDateTime(
                event.createdAt || event.timestamp
              );
              const authorName =
                event.authorName ||
                event.createdBy?.name ||
                strings.unknownUser;
              const formattedNote = formatEventNote(event.note, eventKind);

              return (
                <TimelineItem
                  key={event.id || String(index)}
                  title={strings[eventKindLabelKey(eventKind)] || eventKind}
                  tone={eventKindTone(eventKind)}
                  dateTime={eventDateStr}
                  note={formattedNote}
                  author={authorName}
                  photoUrl={event.photoUrl || event.photo}
                  isLast={index === events.length - 1}
                />
              );
            })}

            {eventCount === 50 ? (
              <Text style={styles.maxHistoryLimitText}>
                {strings.showingLatest50Entries}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
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
  reloadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  reloadErrorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    marginRight: spacing.sm,
  },
  dismissErrorButton: {
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImageContainer: {
    height: 200,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  typeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tones.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  assetType: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.xs + 2,
  },
  badgeWrapper: {
    alignSelf: 'flex-start',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButtonWrapper: {
    flex: 1,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  historySectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  addNoteHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: tones.neutral.bg,
  },
  addNoteHeaderButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 2,
  },
  timelineList: {
    marginTop: spacing.sm,
  },
  mutedPlaceholderText: {
    fontSize: 14,
    color: colors.muted,
    paddingVertical: spacing.sm,
  },
  maxHistoryLimitText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  mapPreviewContainer: {
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  mapPreview: {
    width: '100%',
    height: '100%',
  },
  coordinatesText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm + 2,
    minHeight: 44,
  },
  openMapsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    marginLeft: spacing.xs,
  },
});
