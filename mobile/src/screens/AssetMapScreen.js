/**
 * AssetMapScreen.js
 * Map screen showing all Gram Panchayat assets with valid GPS coordinates.
 * Displays an asset type filter bar, status-colored markers, status legend,
 * marker callout, bottom preview card, and tap-to-detail navigation.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import PrimaryButton from '../components/PrimaryButton';
import {
  ASSET_TYPES,
  typeIcon,
  typeLabel,
  statusLabel,
  statusTone,
} from '../utils/assetUtil';
import { strings } from '../strings';
import { colors, spacing, radius } from '../theme';

// Default initial camera region (Central India)
const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 8.0,
  longitudeDelta: 8.0,
};

// Map backend status to standard colors
function getMarkerColor(status) {
  switch (status) {
    case 'WORKING':
      return '#22c55e'; // Green
    case 'UNDER_REPAIR':
      return '#f59e0b'; // Amber
    case 'FAULTY':
      return '#ef4444'; // Red
    default:
      return colors.muted;
  }
}

// Filter out null, undefined, or invalid coordinates
function filterValidAssets(rawAssets) {
  if (!Array.isArray(rawAssets)) return [];
  return rawAssets.filter((asset) => {
    if (
      asset.lat === null ||
      asset.lat === undefined ||
      asset.lng === null ||
      asset.lng === undefined
    ) {
      return false;
    }
    const lat = Number(asset.lat);
    const lng = Number(asset.lng);
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  });
}

export default function AssetMapScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [assets, setAssets] = useState([]);
  const [selectedType, setSelectedType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);

  const mapRef = useRef(null);
  const requestIdRef = useRef(0);

  // Filter options: "All" + all supported asset types
  const filterOptions = [
    { value: 'ALL', label: strings.all },
    ...ASSET_TYPES,
  ];

  // Fetch assets and filter for valid coordinates
  const fetchAssets = async () => {
    const currentReqId = ++requestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get('/assets?limit=100');
      if (currentReqId !== requestIdRef.current) return;

      const raw = response.data?.assets || [];
      const valid = filterValidAssets(raw);
      setAssets(valid);

      // Fit map view to show all asset markers
      if (valid.length > 1) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            valid.map((a) => ({
              latitude: Number(a.lat),
              longitude: Number(a.lng),
            })),
            {
              edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
              animated: true,
            }
          );
        }, 300);
      } else if (valid.length === 1) {
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: Number(valid[0].lat),
            longitude: Number(valid[0].lng),
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }, 300);
      }
    } catch (err) {
      if (currentReqId !== requestIdRef.current) return;
      if (err?.response?.status === 401) {
        useAuthStore.getState().logout();
        return;
      }
      setError(getErrorMessage(err));
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchAssets();
    }, [])
  );

  // Handle asset type selection and close preview card if selected asset is filtered out
  const handleSelectType = (typeValue) => {
    setSelectedType(typeValue);
    if (selectedAsset && typeValue !== 'ALL' && selectedAsset.type !== typeValue) {
      setSelectedAsset(null);
    }
  };

  // Filter markers based on selected asset type
  const displayedAssets = assets.filter((asset) => {
    if (selectedType === 'ALL') return true;
    return asset.type === selectedType;
  });

  // Navigate to Asset Detail screen
  const handleNavigateToDetail = (asset) => {
    if (!asset) return;
    try {
      navigation.navigate('AssetDetail', { id: asset.id, name: asset.name });
    } catch {
      // Fallback when mounted inside bottom tab navigator
    }
    navigation.navigate(strings.assets, {
      screen: 'AssetDetail',
      params: { id: asset.id, name: asset.name },
    });
  };

  const topOffset = insets.top > 20 ? insets.top : spacing.sm;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        onPress={() => setSelectedAsset(null)}
      >
        {displayedAssets.map((asset) => {
          const lat = Number(asset.lat);
          const lng = Number(asset.lng);
          const markerColor = getMarkerColor(asset.status);

          return (
            <Marker
              key={asset.id}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor={markerColor}
              title={asset.name}
              description={`${typeLabel(asset.type)} · ${statusLabel(asset.status)}`}
              onPress={() => setSelectedAsset(asset)}
            >
              <Callout onPress={() => handleNavigateToDetail(asset)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName} numberOfLines={1}>
                    {asset.name}
                  </Text>
                  <Text style={styles.calloutType}>{typeLabel(asset.type)}</Text>
                  <Text style={[styles.calloutStatus, { color: markerColor }]}>
                    ● {statusLabel(asset.status)}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Top Filter Bar */}
      <View style={[styles.filterBarContainer, { top: topOffset }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        >
          {filterOptions.map((opt) => {
            const isSelected = selectedType === opt.value;
            const count =
              opt.value === 'ALL'
                ? assets.length
                : assets.filter((a) => a.type === opt.value).length;

            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => handleSelectType(opt.value)}
                style={[
                  styles.filterChip,
                  isSelected ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${opt.label}, ${count}`}
                accessibilityState={{ selected: isSelected }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected
                      ? styles.filterChipTextActive
                      : styles.filterChipTextInactive,
                  ]}
                >
                  {opt.label}
                </Text>
                {count > 0 ? (
                  <View
                    style={[
                      styles.filterChipBadge,
                      isSelected
                        ? styles.filterChipBadgeActive
                        : styles.filterChipBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipBadgeText,
                        isSelected
                          ? styles.filterChipBadgeTextActive
                          : styles.filterChipBadgeTextInactive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Empty Filter Pill if selected type has 0 mapped assets */}
      {selectedType !== 'ALL' && displayedAssets.length === 0 && !loading ? (
        <View style={[styles.emptyTypePill, { top: topOffset + 50 }]}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.muted}
            style={styles.emptyTypePillIcon}
          />
          <Text style={styles.emptyTypePillText}>
            {strings.noTypeAssetsOnMap.replace('{type}', typeLabel(selectedType))}
          </Text>
        </View>
      ) : null}

      {/* Loading Indicator */}
      {loading && assets.length === 0 ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}

      {/* Empty State Banner (No assets with coordinates in GP) */}
      {!loading && assets.length === 0 ? (
        <View style={[styles.emptyBanner, { top: topOffset + 54 }]}>
          <Ionicons
            name="location-outline"
            size={22}
            color={colors.primary}
            style={styles.emptyBannerIcon}
          />
          <Text style={styles.emptyBannerText}>
            {strings.noAssetsWithLocation}
          </Text>
        </View>
      ) : null}

      {/* Legend Overlay in top corner below filter bar */}
      <View style={[styles.legendContainer, { top: topOffset + 52 }]}>
        <Text style={styles.legendTitle}>{strings.legendTitle}</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendLabel}>{strings.assetStatusWorking}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendLabel}>{strings.assetStatusUnderRepair}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendLabel}>{strings.assetStatusFaulty}</Text>
        </View>
      </View>

      {/* Bottom Asset Preview Card */}
      {selectedAsset ? (
        <View style={styles.previewCard}>
          <View style={styles.previewCardHeader}>
            <View style={styles.previewIconCircle}>
              <Ionicons
                name={typeIcon(selectedAsset.type)}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedAsset.name}
              </Text>
              <Text style={styles.previewSubtitle}>
                {typeLabel(selectedAsset.type)}
              </Text>
            </View>
            <StatusBadge
              label={statusLabel(selectedAsset.status)}
              tone={statusTone(selectedAsset.status)}
            />
            <TouchableOpacity
              onPress={() => setSelectedAsset(null)}
              style={styles.previewCloseButton}
              accessibilityRole="button"
              accessibilityLabel={strings.dismiss}
            >
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.previewActionRow}>
            <PrimaryButton
              title={strings.viewDetails}
              onPress={() => handleNavigateToDetail(selectedAsset)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterBarContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  filterChipInactive: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipText: {
    fontSize: 13,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  filterChipTextInactive: {
    color: colors.text,
    fontWeight: '500',
  },
  filterChipBadge: {
    marginLeft: spacing.xs + 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  filterChipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterChipBadgeInactive: {
    backgroundColor: colors.pressed,
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipBadgeTextActive: {
    color: colors.white,
  },
  filterChipBadgeTextInactive: {
    color: colors.muted,
  },
  emptyTypePill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 5,
  },
  emptyTypePillIcon: {
    marginRight: spacing.xs,
  },
  emptyTypePillText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
  },
  emptyBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 5,
  },
  emptyBannerIcon: {
    marginRight: spacing.sm,
  },
  emptyBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  legendContainer: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 4,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs + 2,
  },
  legendLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  callout: {
    padding: spacing.xs,
    minWidth: 120,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  calloutType: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  calloutStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  previewCard: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 20,
  },
  previewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pressed,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  previewInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  previewSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  previewCloseButton: {
    minHeight: 36,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  previewActionRow: {
    marginTop: spacing.xs,
  },
});
