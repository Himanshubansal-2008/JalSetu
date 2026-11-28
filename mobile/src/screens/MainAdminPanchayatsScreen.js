/**
 * MainAdminPanchayatsScreen.js
 * Comprehensive Gram Panchayat directory and operational inspection tool for Main Administrator.
 * Lists all registered Gram Panchayats across the state, supports searching and filtering,
 * and allows deep-dive inspection of any Gram Panchayat's operational health.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { formatPaiseToRupees } from '../utils/currency';
import SearchBar from '../components/SearchBar';
import ErrorBanner from '../components/ErrorBanner';
import StatusBadge from '../components/StatusBadge';
import GpInspectionModal from '../components/GpInspectionModal';
import { colors, tones, spacing, radius } from '../theme';

export default function MainAdminPanchayatsScreen({ navigation }) {
  const [gps, setGps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'APPROVED' | 'PENDING' | 'FAULTS'

  // GP Detail Inspection Modal state
  const [selectedGpForInspect, setSelectedGpForInspect] = useState(null);
  const [inspectModalVisible, setInspectModalVisible] = useState(false);

  const fetchGps = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await apiClient.get('/gps/overview');
      setGps(res.data?.gps || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch Gram Panchayats'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchGps();
    }, [fetchGps])
  );

  const handleInspectGp = (gpItem) => {
    setSelectedGpForInspect(gpItem);
    setInspectModalVisible(true);
  };

  // Filter and search
  const filteredGps = gps.filter((g) => {
    // Mode filter
    if (filterMode === 'APPROVED' && !g.isApproved) return false;
    if (filterMode === 'PENDING' && g.isApproved) return false;
    if (filterMode === 'FAULTS' && (g.stats.faultyAssets === 0 && g.stats.lowStockItems === 0)) return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      g.name?.toLowerCase().includes(q) ||
      g.village?.toLowerCase().includes(q) ||
      g.district?.toLowerCase().includes(q) ||
      g.state?.toLowerCase().includes(q) ||
      g.admin?.name?.toLowerCase().includes(q) ||
      g.admin?.phone?.includes(q)
    );
  });

  const renderItem = ({ item }) => {
    const isApproved = item.isApproved;
    const stats = item.stats || {};

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleInspectGp(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.gpName}>{item.name}</Text>
            <Text style={styles.gpLocation}>
              {item.village}, {item.district} • {item.state}
            </Text>
          </View>
          <StatusBadge
            label={isApproved ? 'APPROVED' : 'PENDING'}
            tone={isApproved ? 'success' : 'warning'}
          />
        </View>

        {item.admin ? (
          <Text style={styles.adminText}>
            Primary Admin: {item.admin.name} • {item.admin.phone}
          </Text>
        ) : null}

        {/* Live Operational Metrics Chips */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Water Assets</Text>
            <Text style={styles.statValue}>
              {stats.totalAssets || 0}
              {stats.faultyAssets > 0 ? (
                <Text style={{ color: tones.danger.fg }}> ({stats.faultyAssets} faulty)</Text>
              ) : null}
            </Text>
          </View>

          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Workers</Text>
            <Text style={styles.statValue}>{stats.workersCount || 0}</Text>
          </View>

          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Consumers</Text>
            <Text style={styles.statValue}>{stats.totalConsumers || 0}</Text>
          </View>

          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Tax Revenue</Text>
            <Text style={styles.statValue}>
              {formatPaiseToRupees(stats.totalCollectedPaise || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.inspectHint}>Tap to view operational breakdown</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gram Panchayat Directory</Text>
        <Text style={styles.headerSubtitle}>
          Real-time operations, staff, and billing monitor across all Panchayats
        </Text>
      </View>

      <View style={styles.container}>
        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by Panchayat name, village, or district..."
        />

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'ALL' && styles.filterChipActive]}
            onPress={() => setFilterMode('ALL')}
          >
            <Text style={[styles.filterChipText, filterMode === 'ALL' && styles.filterChipTextActive]}>
              All ({gps.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'APPROVED' && styles.filterChipActive]}
            onPress={() => setFilterMode('APPROVED')}
          >
            <Text style={[styles.filterChipText, filterMode === 'APPROVED' && styles.filterChipTextActive]}>
              Approved ({gps.filter((g) => g.isApproved).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'PENDING' && styles.filterChipActive]}
            onPress={() => setFilterMode('PENDING')}
          >
            <Text style={[styles.filterChipText, filterMode === 'PENDING' && styles.filterChipTextActive]}>
              Pending ({gps.filter((g) => !g.isApproved).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'FAULTS' && styles.filterChipActive]}
            onPress={() => setFilterMode('FAULTS')}
          >
            <Text style={[styles.filterChipText, filterMode === 'FAULTS' && styles.filterChipTextActive]}>
              With Alerts
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Notice */}
        <ErrorBanner
          error={error}
          onRetry={() => fetchGps()}
          retryLabel="Retry"
        />

        {/* List of GPs */}
        <FlatList
          data={filteredGps}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchGps({ isRefresh: true })}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={48} color={colors.muted} />
                <Text style={styles.emptyTitle}>No Panchayats Found</Text>
                <Text style={styles.emptySubtitle}>
                  Try clearing your search query or filter selection.
                </Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* GP Deep-Dive Inspection Modal */}
      <GpInspectionModal
        visible={inspectModalVisible}
        gp={selectedGpForInspect}
        onClose={() => setInspectModalVisible(false)}
        onApproveSuccess={() => fetchGps({ isRefresh: true })}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  gpName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  gpLocation: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  adminText: {
    fontSize: 12,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: spacing.xs,
  },
  statChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inspectHint: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 1.5,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
