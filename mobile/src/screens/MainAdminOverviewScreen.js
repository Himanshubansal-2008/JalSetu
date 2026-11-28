/**
 * MainAdminOverviewScreen.js
 * Executive state-level oversight dashboard for Main Administrator (Super Admin).
 * Displays platform-wide KPIs, pending approval alerts, water security highlights,
 * and high-priority Gram Panchayat alerts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { formatPaiseToRupees } from '../utils/currency';
import MetricCard from '../components/MetricCard';
import ErrorBanner from '../components/ErrorBanner';
import StatusBadge from '../components/StatusBadge';
import GpInspectionModal from '../components/GpInspectionModal';
import { colors, tones, spacing, radius } from '../theme';

export default function MainAdminOverviewScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overviewData, setOverviewData] = useState(null);

  // Active view tab on Overview: 'ATTENTION' | 'ALL'
  const [activeGpView, setActiveGpView] = useState('ATTENTION');

  // GP Deep-Dive Inspection Modal state
  const [selectedGpForInspect, setSelectedGpForInspect] = useState(null);
  const [inspectModalVisible, setInspectModalVisible] = useState(false);

  const fetchOverview = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!overviewData) {
      setLoading(true);
    }
    setError('');

    try {
      const res = await apiClient.get('/gps/overview');
      setOverviewData(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch platform overview'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [overviewData]);

  useFocusEffect(
    useCallback(() => {
      fetchOverview();
    }, [])
  );

  const summary = overviewData?.summary || {
    totalGps: 0,
    approvedGps: 0,
    pendingGps: 0,
    totalAssets: 0,
    faultyAssets: 0,
    underRepairAssets: 0,
    totalWorkers: 0,
    totalConsumers: 0,
    totalCollectedPaise: 0,
    totalLowStockItems: 0,
  };

  const gps = overviewData?.gps || [];
  // Gram Panchayats with critical attention required (faulty assets or pending approval)
  const alertGps = gps.filter((g) => !g.isApproved || g.stats.faultyAssets > 0 || g.stats.lowStockItems > 0);

  const handleInspectGp = (gpItem) => {
    setSelectedGpForInspect(gpItem);
    setInspectModalVisible(true);
  };

  const displayedGps = activeGpView === 'ATTENTION' ? alertGps : gps;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.superAdminPill}>
            <Ionicons name="shield" size={12} color="#92400E" style={{ marginRight: 4 }} />
            <Text style={styles.superAdminPillText}>STATE OVERSIGHT • JJM</Text>
          </View>
          <Text style={styles.headerTitle}>Platform Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Welcome, {user?.name || 'Main Administrator'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('ProfileTab')}
          accessibilityLabel="Main Admin Profile"
        >
          <Ionicons name="person-circle" size={36} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOverview({ isRefresh: true })}
            colors={[colors.primary]}
          />
        }
      >
        {/* Error Notice */}
        <ErrorBanner
          error={error}
          onRetry={() => fetchOverview()}
          retryLabel="Retry Loading"
        />

        {/* Pending Approvals Callout Banner */}
        {summary.pendingGps > 0 ? (
          <TouchableOpacity
            style={styles.pendingCalloutCard}
            onPress={() => navigation.navigate('ApprovalsTab')}
            activeOpacity={0.85}
          >
            <View style={styles.calloutIconCircle}>
              <Ionicons name="time" size={24} color="#B45309" />
            </View>
            <View style={styles.calloutTextBox}>
              <Text style={styles.calloutTitle}>
                {summary.pendingGps} Gram Panchayat{summary.pendingGps > 1 ? 's' : ''} Awaiting Approval
              </Text>
              <Text style={styles.calloutSubtitle}>
                Tap to review registrations and grant login access
              </Text>
            </View>
            <View style={styles.calloutActionBtn}>
              <Text style={styles.calloutActionBtnText}>Review</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Executive Metric Cards Grid */}
        <Text style={styles.sectionHeading}>System-Wide Overview</Text>

        <View style={styles.metricRow}>
          <MetricCard
            label="Total Panchayats"
            value={summary.totalGps}
            subtitle={`${summary.approvedGps} approved • ${summary.pendingGps} pending`}
            icon="business-outline"
            tone="info"
            onPress={() => navigation.navigate('PanchayatsTab')}
          />
          <MetricCard
            label="Total Water Assets"
            value={summary.totalAssets}
            subtitle={`${summary.faultyAssets} faulty • ${summary.underRepairAssets} repairing`}
            icon="cube-outline"
            tone={summary.faultyAssets > 0 ? 'warning' : 'success'}
          />
        </View>

        <View style={styles.metricRow}>
          <MetricCard
            label="Total Consumers"
            value={summary.totalConsumers}
            subtitle="Rural households served"
            icon="people-outline"
            tone="default"
          />
          <MetricCard
            label="Field Workers"
            value={summary.totalWorkers}
            subtitle="Active operators & linemen"
            icon="construct-outline"
            tone="default"
          />
        </View>

        <View style={styles.metricRow}>
          <MetricCard
            label="Water Tax Collected"
            value={formatPaiseToRupees(summary.totalCollectedPaise)}
            subtitle="Total collections across GPs"
            icon="cash-outline"
            tone="success"
          />
          <MetricCard
            label="Low-Stock Alerts"
            value={summary.totalLowStockItems}
            subtitle="Chemical & spares shortages"
            icon="alert-circle-outline"
            tone={summary.totalLowStockItems > 0 ? 'danger' : 'success'}
          />
        </View>

        {/* Gram Panchayats Inspection & Oversight Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Panchayat Oversight</Text>
          <TouchableOpacity onPress={() => navigation.navigate('PanchayatsTab')}>
            <Text style={styles.viewAllLink}>Directory ({gps.length})</Text>
          </TouchableOpacity>
        </View>

        {/* View Switcher Chips */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeGpView === 'ATTENTION' && styles.segmentBtnActive]}
            onPress={() => setActiveGpView('ATTENTION')}
          >
            <Ionicons
              name="alert-circle"
              size={14}
              color={activeGpView === 'ATTENTION' ? '#B45309' : colors.muted}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeGpView === 'ATTENTION' && styles.segmentBtnTextActive,
              ]}
            >
              Needs Attention ({alertGps.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeGpView === 'ALL' && styles.segmentBtnActive]}
            onPress={() => setActiveGpView('ALL')}
          >
            <Ionicons
              name="business"
              size={14}
              color={activeGpView === 'ALL' ? colors.primary : colors.muted}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeGpView === 'ALL' && styles.segmentBtnTextActive,
              ]}
            >
              All Panchayats ({gps.length})
            </Text>
          </TouchableOpacity>
        </View>

        {displayedGps.length === 0 ? (
          <View style={styles.allClearCard}>
            <Ionicons name="checkmark-circle" size={28} color={tones.success.fg} />
            <Text style={styles.allClearTitle}>All Systems Operational</Text>
            <Text style={styles.allClearSubtitle}>
              {activeGpView === 'ATTENTION'
                ? 'No critical asset breakdowns or pending approvals at this time.'
                : 'No Gram Panchayats found.'}
            </Text>
          </View>
        ) : (
          displayedGps.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.gpAlertCard}
              onPress={() => handleInspectGp(g)}
              activeOpacity={0.75}
            >
              <View style={styles.gpAlertHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.gpAlertName}>{g.name}</Text>
                  <Text style={styles.gpAlertLocation}>
                    {g.village}, {g.district} ({g.state})
                  </Text>
                </View>
                <StatusBadge
                  label={g.isApproved ? (g.stats.faultyAssets > 0 || g.stats.lowStockItems > 0 ? 'ALERT' : 'APPROVED') : 'PENDING'}
                  tone={g.isApproved ? (g.stats.faultyAssets > 0 || g.stats.lowStockItems > 0 ? 'warning' : 'success') : 'danger'}
                />
              </View>

              {/* Status & alert tags */}
              <View style={styles.alertPillsRow}>
                {!g.isApproved ? (
                  <View style={[styles.badgeTag, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="time" size={12} color="#B45309" style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeTagText, { color: '#B45309' }]}>Registration Pending</Text>
                  </View>
                ) : null}

                {g.stats.faultyAssets > 0 ? (
                  <View style={[styles.badgeTag, { backgroundColor: tones.danger.bg }]}>
                    <Ionicons name="warning" size={12} color={tones.danger.fg} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeTagText, { color: tones.danger.fg }]}>
                      {g.stats.faultyAssets} Faulty Asset{g.stats.faultyAssets > 1 ? 's' : ''}
                    </Text>
                  </View>
                ) : null}

                {g.stats.lowStockItems > 0 ? (
                  <View style={[styles.badgeTag, { backgroundColor: tones.warning.bg }]}>
                    <Ionicons name="alert-circle" size={12} color={tones.warning.fg} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeTagText, { color: tones.warning.fg }]}>
                      {g.stats.lowStockItems} Low Stock
                    </Text>
                  </View>
                ) : null}

                {/* Operational Quick Metrics */}
                <View style={[styles.badgeTag, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="water" size={12} color={colors.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.badgeTagText, { color: colors.text }]}>
                    {g.stats.totalAssets || 0} Assets
                  </Text>
                </View>

                <View style={[styles.badgeTag, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="people" size={12} color={colors.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.badgeTagText, { color: colors.text }]}>
                    {g.stats.totalConsumers || 0} Homes
                  </Text>
                </View>
              </View>

              {g.admin ? (
                <Text style={styles.gpAdminContact}>
                  Admin: {g.admin.name} • {g.admin.phone}
                </Text>
              ) : null}

              {/* Tap to inspect prompt */}
              <View style={styles.inspectHintRow}>
                <Text style={styles.inspectHintText}>Tap to view full panchayat data & operations</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* GP Deep-Dive Inspection Modal */}
      <GpInspectionModal
        visible={inspectModalVisible}
        gp={selectedGpForInspect}
        onClose={() => setInspectModalVisible(false)}
        onApproveSuccess={() => fetchOverview({ isRefresh: true })}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  superAdminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: 4,
  },
  superAdminPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  profileBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  pendingCalloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  calloutIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  calloutTextBox: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  calloutSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  calloutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B45309',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  calloutActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm + 2,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  allClearCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tones.success.fg,
    marginTop: spacing.xs,
  },
  allClearSubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  gpAlertCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpAlertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gpAlertName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  gpAlertLocation: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  alertPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  badgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gpAdminContact: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: colors.primary,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  inspectHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inspectHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});
