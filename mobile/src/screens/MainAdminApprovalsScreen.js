/**
 * MainAdminApprovalsScreen.js
 * Dedicated verification & registration approval command center for Main Administrator.
 * Allows approving or declining pending Gram Panchayat registrations with decline reasons,
 * direct applicant phone calls, and search filters.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import SearchBar from '../components/SearchBar';
import ErrorBanner from '../components/ErrorBanner';
import StatusBadge from '../components/StatusBadge';
import { colors, tones, spacing, radius } from '../theme';

export default function MainAdminApprovalsScreen({ navigation }) {
  const [pendingGps, setPendingGps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Approve state
  const [approvingId, setApprovingId] = useState(null);

  // Decline modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedGpForReject, setSelectedGpForReject] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const fetchPendingGps = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await apiClient.get('/gps/pending');
      setPendingGps(res.data?.pendingGps || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch pending Gram Panchayats'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPendingGps();
    }, [fetchPendingGps])
  );

  // Approve GP handler
  const handleApproveGp = useCallback((targetGp) => {
    Alert.alert(
      'Approve Gram Panchayat',
      `Approve "${targetGp.name}" (${targetGp.village}, ${targetGp.district})?\n\nOnce approved, its administrators and field workers will be permitted to log in immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Activate',
          onPress: async () => {
            try {
              setApprovingId(targetGp.id);
              await apiClient.patch(`/gps/${targetGp.id}/approve`);
              Alert.alert(
                'Approval Successful',
                `Gram Panchayat "${targetGp.name}" has been approved! Its administrators can now log in.`
              );
              fetchPendingGps();
            } catch (err) {
              Alert.alert('Approval Failed', getErrorMessage(err));
            } finally {
              setApprovingId(null);
            }
          },
        },
      ]
    );
  }, [fetchPendingGps]);

  // Open Decline Modal
  const openRejectModal = useCallback((targetGp) => {
    setSelectedGpForReject(targetGp);
    setRejectNote('');
    setRejectError('');
    setRejectModalVisible(true);
  }, []);

  // Submit Decline
  const handleConfirmReject = useCallback(async () => {
    if (!selectedGpForReject) return;
    const cleanNote = rejectNote.trim();
    if (!cleanNote || cleanNote.length < 3) {
      setRejectError('Please write a note explaining why this registration was declined (minimum 3 characters).');
      return;
    }

    try {
      setRejectSubmitting(true);
      setRejectError('');
      await apiClient.patch(`/gps/${selectedGpForReject.id}/reject`, { note: cleanNote });
      setRejectModalVisible(false);
      Alert.alert(
        'Registration Declined',
        `Gram Panchayat "${selectedGpForReject.name}" was declined. The applicant may now reapply by signing up again.`
      );
      setSelectedGpForReject(null);
      setRejectNote('');
      fetchPendingGps();
    } catch (err) {
      setRejectError(getErrorMessage(err));
    } finally {
      setRejectSubmitting(false);
    }
  }, [selectedGpForReject, rejectNote, fetchPendingGps]);

  // Call applicant admin phone
  const handleCallApplicant = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Call Failed', `Unable to place call to ${phoneNumber}`);
    });
  };

  // Filtered pending GPs by search
  const filteredGps = pendingGps.filter((g) => {
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
    const isApproving = approvingId === item.id;

    return (
      <View style={styles.gpCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.gpName}>{item.name}</Text>
            <Text style={styles.gpLocation}>
              {item.village}, {item.district} • {item.state}
            </Text>
          </View>
          <StatusBadge label="AWAITING APPROVAL" tone="warning" />
        </View>

        {/* Applicant Details Row */}
        {item.admin ? (
          <View style={styles.applicantBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.applicantLabel}>Primary Applicant (Admin):</Text>
              <Text style={styles.applicantName}>{item.admin.name}</Text>
              <Text style={styles.applicantPhone}>{item.admin.phone}</Text>
            </View>

            <TouchableOpacity
              style={styles.callButton}
              onPress={() => handleCallApplicant(item.admin.phone)}
              activeOpacity={0.7}
              accessibilityLabel={`Call ${item.admin.name}`}
            >
              <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Action Buttons Row */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={[styles.declineBtn, (isApproving || rejectSubmitting) && styles.disabledBtn]}
            onPress={() => openRejectModal(item)}
            disabled={isApproving || rejectSubmitting}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.danger} style={{ marginRight: 4 }} />
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveBtn, (isApproving || rejectSubmitting) && styles.disabledBtn]}
            onPress={() => handleApproveGp(item)}
            disabled={isApproving || rejectSubmitting}
            activeOpacity={0.8}
          >
            {isApproving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.approveBtnText}>Approve & Activate</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Pending GP Approvals</Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{pendingGps.length}</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          Review incoming Gram Panchayat signups and authorize access
        </Text>
      </View>

      <View style={styles.container}>
        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by GP name, village, or admin phone..."
        />

        {/* Error Notice */}
        <ErrorBanner
          error={error}
          onRetry={() => fetchPendingGps()}
          retryLabel="Retry"
        />

        {/* List of Pending Registrations */}
        <FlatList
          data={filteredGps}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPendingGps({ isRefresh: true })}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark" size={56} color={tones.success.fg} />
                <Text style={styles.emptyTitle}>Queue All Clear!</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? 'No pending Gram Panchayats match your search.'
                    : 'There are no Gram Panchayats waiting for approval.'}
                </Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* Decline / Reject GP Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!rejectSubmitting) setRejectModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Ionicons name="close-circle" size={24} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Decline Gram Panchayat</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedGpForReject?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                disabled={rejectSubmitting}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInstruction}>
              Please write a note explaining why this registration is being declined. The Gram Panchayat will be removed so the applicant can reapply.
            </Text>

            {rejectError ? <Text style={styles.modalErrorText}>{rejectError}</Text> : null}

            <TextInput
              style={styles.modalTextInput}
              placeholder="e.g. Village name does not match official records / Duplicate registration"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              value={rejectNote}
              onChangeText={(t) => {
                setRejectNote(t);
                if (rejectError) setRejectError('');
              }}
              editable={!rejectSubmitting}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRejectModalVisible(false)}
                disabled={rejectSubmitting}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmDeclineButton,
                  rejectSubmitting && styles.disabledBtn,
                ]}
                onPress={handleConfirmReject}
                disabled={rejectSubmitting}
                activeOpacity={0.8}
              >
                {rejectSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmDeclineButtonText}>Decline & Allow Reapply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  badgeCount: {
    backgroundColor: '#B45309',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
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
  listContent: {
    paddingBottom: spacing.xl * 2,
  },
  gpCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  gpName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  gpLocation: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  applicantBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  applicantLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  applicantName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 1,
  },
  applicantPhone: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 1,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.info.fg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  declineBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success || '#16A34A',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
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
    fontSize: 18,
    fontWeight: '700',
    color: tones.success.fg,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalIconBox: {
    marginRight: spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  modalInstruction: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  modalErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  modalConfirmDeclineButton: {
    backgroundColor: colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  modalConfirmDeclineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
