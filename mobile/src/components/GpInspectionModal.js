/**
 * GpInspectionModal.js
 * Comprehensive deep-dive inspection modal for Gram Panchayat operational health.
 * Shows infrastructure, staff, consumer connections, tax collections, and inventory.
 * Used by Main Administrator across Overview and Panchayat directory screens.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { formatPaiseToRupees } from '../utils/currency';
import StatusBadge from './StatusBadge';
import { colors, tones, spacing, radius } from '../theme';

export default function GpInspectionModal({
  visible,
  gp,
  onClose,
  onApproveSuccess,
  navigation,
}) {
  const [detailedGp, setDetailedGp] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [approving, setApproving] = useState(false);

  // When gp changes or modal becomes visible, sync state and fetch full breakdown
  useEffect(() => {
    if (!visible || !gp?.id) {
      setDetailedGp(null);
      return;
    }

    setDetailedGp(gp); // Initial preview data for instant rendering

    let isMounted = true;
    const loadDetails = async () => {
      try {
        setLoadingDetails(true);
        const res = await apiClient.get(`/gps/${gp.id}`);
        if (isMounted && res.data?.gp) {
          setDetailedGp(res.data.gp);
        }
      } catch (err) {
        // Fallback silently to initial preview data
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [visible, gp?.id]);

  if (!visible || !gp) return null;

  const currentGp = detailedGp || gp;
  const stats = currentGp.stats || {};
  const admin = currentGp.admin;
  const isApproved = Boolean(currentGp.isApproved);

  const handleCallAdmin = (phone) => {
    if (!phone) {
      Alert.alert('No Phone', 'Administrator phone number is not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Call Failed', `Unable to open dialer for ${phone}`);
    });
  };

  const handleQuickApprove = async () => {
    Alert.alert(
      'Approve Gram Panchayat',
      `Grant full platform access to "${currentGp.name}" (${currentGp.village}, ${currentGp.district})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve Access',
          style: 'default',
          onPress: async () => {
            try {
              setApproving(true);
              await apiClient.patch(`/gps/${currentGp.id}/approve`);
              setDetailedGp((prev) => ({ ...prev, isApproved: true }));
              if (onApproveSuccess) onApproveSuccess(currentGp.id);
              Alert.alert('Approved', `Gram Panchayat "${currentGp.name}" has been approved!`);
            } catch (err) {
              Alert.alert('Error', getErrorMessage(err, 'Failed to approve Gram Panchayat'));
            } finally {
              setApproving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={styles.titleRow}>
                <Text style={styles.gpName} numberOfLines={1}>
                  {currentGp.name}
                </Text>
              </View>
              <Text style={styles.gpLocation}>
                {currentGp.village}{currentGp.block ? `, ${currentGp.block}` : ''}, {currentGp.district} • {currentGp.state}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <Ionicons name="close-circle" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status & Quick Action Banner */}
            <View style={styles.statusRow}>
              <StatusBadge
                label={isApproved ? 'STATUS: APPROVED & ACTIVE' : 'STATUS: REGISTRATION PENDING'}
                tone={isApproved ? 'success' : 'warning'}
              />
              {loadingDetails ? (
                <View style={styles.syncingPill}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.syncingText}>Updating...</Text>
                </View>
              ) : null}
            </View>

            {/* Quick Action Buttons */}
            <View style={styles.actionButtonGroup}>
              {admin?.phone ? (
                <TouchableOpacity
                  style={styles.callAdminBtn}
                  onPress={() => handleCallAdmin(admin.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.callAdminBtnText}>Call Admin ({admin.phone})</Text>
                </TouchableOpacity>
              ) : null}

              {!isApproved ? (
                <TouchableOpacity
                  style={[styles.approveBtn, approving && { opacity: 0.6 }]}
                  onPress={handleQuickApprove}
                  disabled={approving}
                  activeOpacity={0.8}
                >
                  {approving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.approveBtnText}>Approve Panchayat</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Designated Administrator Card */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="person" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Designated Administrator (Sarpanch)</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Admin Name:</Text>
                <Text style={styles.infoValue}>{admin?.name || 'Not assigned yet'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number:</Text>
                <Text style={styles.infoValue}>{admin?.phone || 'Not available'}</Text>
              </View>
              {currentGp.createdAt ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Registered On:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(currentGp.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Water Infrastructure Breakdown */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="water" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Water Infrastructure & Health</Text>
              </View>

              <View style={styles.metricGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricBoxNumber}>{stats.totalAssets || 0}</Text>
                  <Text style={styles.metricBoxLabel}>Total Assets</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={[styles.metricBoxNumber, { color: tones.success.fg }]}>
                    {stats.workingAssets || 0}
                  </Text>
                  <Text style={styles.metricBoxLabel}>Working</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text
                    style={[
                      styles.metricBoxNumber,
                      { color: stats.faultyAssets > 0 ? tones.danger.fg : colors.text },
                    ]}
                  >
                    {stats.faultyAssets || 0}
                  </Text>
                  <Text style={styles.metricBoxLabel}>Faulty</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricBoxNumber}>{stats.underRepairAssets || 0}</Text>
                  <Text style={styles.metricBoxLabel}>Repairing</Text>
                </View>
              </View>

              {/* Faulty Assets Warning Alert */}
              {currentGp.faultyAssetsList && currentGp.faultyAssetsList.length > 0 ? (
                <View style={styles.faultyAlertBox}>
                  <View style={styles.faultyAlertTitleRow}>
                    <Ionicons name="alert-circle" size={16} color={tones.danger.fg} style={{ marginRight: 6 }} />
                    <Text style={styles.faultyAlertTitle}>
                      {currentGp.faultyAssetsList.length} Asset{currentGp.faultyAssetsList.length > 1 ? 's' : ''} Requiring Repair
                    </Text>
                  </View>
                  {currentGp.faultyAssetsList.map((asset) => (
                    <View key={asset.id} style={styles.faultyItemRow}>
                      <Text style={styles.faultyItemName}>• {asset.name} ({asset.type})</Text>
                      <StatusBadge
                        label={asset.status}
                        tone={asset.status === 'FAULTY' ? 'danger' : 'warning'}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Field Operators & Staff */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="construct" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Field Staff & Workforce</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Active Operators & Workers:</Text>
                <Text style={styles.infoValue}>{stats.workersCount || 0} field personnel</Text>
              </View>

              {currentGp.workers && currentGp.workers.length > 0 ? (
                <View style={styles.workerList}>
                  {currentGp.workers.map((w) => (
                    <View key={w.id} style={styles.workerItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workerName}>{w.name}</Text>
                        <Text style={styles.workerPhone}>{w.phone}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.workerCallBtn}
                        onPress={() => handleCallAdmin(w.phone)}
                      >
                        <Ionicons name="call" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Household Consumers & Revenue */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="cash" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Consumers & Tax Collections</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Registered Households:</Text>
                <Text style={styles.infoValue}>{stats.totalConsumers || 0} connections</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total Tax Collected:</Text>
                <Text style={[styles.infoValue, { color: tones.success.fg, fontWeight: '700' }]}>
                  {formatPaiseToRupees(stats.totalCollectedPaise || 0)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pending Water Bills:</Text>
                <Text style={[styles.infoValue, { color: stats.pendingBillsCount > 0 ? tones.warning.fg : colors.text }]}>
                  {stats.pendingBillsCount || 0} bills due
                </Text>
              </View>
            </View>

            {/* Inventory & Spares */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="cube" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Inventory & Spare Parts</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total Cataloged Spares:</Text>
                <Text style={styles.infoValue}>{stats.totalInventoryItems || 0} items</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Low-Stock Shortages:</Text>
                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: stats.lowStockItems > 0 ? tones.danger.fg : tones.success.fg,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {stats.lowStockItems > 0 ? `${stats.lowStockItems} items below threshold` : 'Adequate Stock'}
                </Text>
              </View>

              {currentGp.lowStockItemsList && currentGp.lowStockItemsList.length > 0 ? (
                <View style={styles.lowStockListBox}>
                  <Text style={styles.lowStockListTitle}>Items Needing Reorder:</Text>
                  {currentGp.lowStockItemsList.map((item) => (
                    <View key={item.id} style={styles.lowStockItemRow}>
                      <Text style={styles.lowStockItemName}>• {item.name}</Text>
                      <Text style={styles.lowStockItemQty}>
                        Qty: {item.quantity} {item.unit} (Min: {item.reorderLevel})
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={{ height: spacing.xl * 2 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  gpLocation: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  syncingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncingText: {
    fontSize: 11,
    color: colors.muted,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  callAdminBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  callAdminBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tones.success.fg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardSection: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  metricBoxNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  metricBoxLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  faultyAlertBox: {
    backgroundColor: tones.danger.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  faultyAlertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  faultyAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  faultyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  faultyItemName: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  workerList: {
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  workerName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  workerPhone: {
    fontSize: 11,
    color: colors.muted,
  },
  workerCallBtn: {
    padding: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: radius.pill,
  },
  lowStockListBox: {
    backgroundColor: tones.warning.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lowStockListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tones.warning.fg,
    marginBottom: 4,
  },
  lowStockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  lowStockItemName: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  lowStockItemQty: {
    fontSize: 11,
    color: tones.danger.fg,
    fontWeight: '600',
  },
});
