/**
 * ProfileScreen.js
 * Profile & Settings screen for both Admin and Worker users in the JalKosh mobile app.
 *
 * Features:
 * - Clean identity card: Name, phone, role badge ("Gram Panchayat Admin" vs. "Field Worker")
 * - Gram Panchayat profile: Name, village, block, district, state
 * - Admin shortcut: "Manage Field Workers" row navigating to ManageWorkersScreen
 * - Prominent Logout button with native Alert confirmation
 * - App version and compliance information
 * - Pull-to-refresh to sync latest profile data from /api/auth/me
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { colors, tones, spacing, radius } from '../theme';

export default function ProfileScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const gp = useAuthStore((state) => state.gp);
  const logout = useAuthStore((state) => state.logout);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);

  const role = (user?.role || '').toLowerCase();
  const isMainAdmin = role === 'main_admin' || Boolean(user?.isMainAdmin || user?.phone === '9992934154');
  const isAdmin = role === 'admin' || isMainAdmin;

  const [refreshing, setRefreshing] = useState(false);
  const [pendingGps, setPendingGps] = useState([]);
  const [loadingPendingGps, setLoadingPendingGps] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  // All GPs live activity monitor (Main Admin only)
  const [allGps, setAllGps] = useState([]);
  const [loadingAllGps, setLoadingAllGps] = useState(false);

  // Reject / Decline modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedGpForReject, setSelectedGpForReject] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const fetchPendingGps = useCallback(async () => {
    if (!isMainAdmin) return;
    try {
      setLoadingPendingGps(true);
      const res = await apiClient.get('/gps/pending');
      setPendingGps(res.data?.pendingGps || []);
    } catch (_) {
      // Ignore background fetch error
    } finally {
      setLoadingPendingGps(false);
    }
  }, [isMainAdmin]);

  const fetchAllGpsOverview = useCallback(async () => {
    if (!isMainAdmin) return;
    try {
      setLoadingAllGps(true);
      const res = await apiClient.get('/gps/overview');
      setAllGps(res.data?.gps || []);
    } catch (_) {
      // Ignore background fetch error
    } finally {
      setLoadingAllGps(false);
    }
  }, [isMainAdmin]);

  const handleApproveGp = useCallback((targetGp) => {
    Alert.alert(
      'Approve Gram Panchayat',
      `Approve "${targetGp.name}" (${targetGp.village}, ${targetGp.district})?\n\nOnce approved, its administrators and workers will be permitted to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve GP',
          onPress: async () => {
            try {
              setApprovingId(targetGp.id);
              await apiClient.patch(`/gps/${targetGp.id}/approve`);
              Alert.alert('Approved', `Gram Panchayat "${targetGp.name}" is now approved!`);
              fetchPendingGps();
              fetchAllGpsOverview();
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

  const openRejectModal = useCallback((targetGp) => {
    setSelectedGpForReject(targetGp);
    setRejectNote('');
    setRejectError('');
    setRejectModalVisible(true);
  }, []);

  const handleConfirmReject = useCallback(async () => {
    if (!selectedGpForReject) return;
    const cleanNote = rejectNote.trim();
    if (!cleanNote || cleanNote.length < 3) {
      setRejectError('Please write a note explaining why the registration was declined (minimum 3 characters).');
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
      fetchAllGpsOverview();
    } catch (err) {
      setRejectError(getErrorMessage(err));
    } finally {
      setRejectSubmitting(false);
    }
  }, [selectedGpForReject, rejectNote, fetchPendingGps]);

  // Sync profile data on pull-to-refresh or focus
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof fetchProfile === 'function') {
        await fetchProfile();
      }
      if (isMainAdmin) {
        await Promise.all([fetchPendingGps(), fetchAllGpsOverview()]);
      }
    } catch (err) {
      // Handled by 401 interceptor if expired
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchPendingGps, fetchAllGpsOverview, isMainAdmin]);

  useFocusEffect(
    useCallback(() => {
      if (typeof fetchProfile === 'function') {
        fetchProfile().catch(() => {});
      }
      if (isMainAdmin) {
        fetchPendingGps().catch(() => {});
        fetchAllGpsOverview().catch(() => {});
      }
    }, [fetchProfile, fetchPendingGps, fetchAllGpsOverview, isMainAdmin])
  );

  // Logout action with native confirmation
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log Out',
      'Log out of JalKosh on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  }, [logout]);

  // Resolved metadata
  const gpName =
    gp?.name ||
    user?.gp?.name ||
    user?.gpName ||
    'Gram Panchayat';

  const village = gp?.village || user?.gp?.village || user?.village || '';
  const block = gp?.block || user?.gp?.block || user?.block || '';
  const district = gp?.district || user?.gp?.district || user?.district || '';
  const state = gp?.state || user?.gp?.state || user?.state || '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Profile & Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* 1. User Identity Card */}
        <View style={styles.card}>
          <View style={styles.identityHeader}>
            <View
              style={[
                styles.userAvatar,
                isAdmin ? styles.adminAvatar : styles.workerAvatar,
              ]}
            >
              <Text style={styles.userAvatarText}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.identityTextContainer}>
              <Text style={styles.userNameText} numberOfLines={1}>
                {user?.name || 'User'}
              </Text>

              <View style={styles.phoneRow}>
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={colors.muted}
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.phoneText}>{user?.phone || 'No phone set'}</Text>
              </View>

              {/* Role Badge */}
              <View
                style={[
                  styles.roleBadge,
                  isMainAdmin
                    ? styles.mainAdminRoleBadge
                    : isAdmin
                    ? styles.adminRoleBadge
                    : styles.workerRoleBadge,
                ]}
              >
                <Ionicons
                  name={isMainAdmin ? 'shield' : isAdmin ? 'shield-checkmark' : 'construct'}
                  size={13}
                  color={isMainAdmin ? '#B45309' : isAdmin ? tones.info.fg : tones.success.fg}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.roleBadgeText,
                    isMainAdmin
                      ? styles.mainAdminRoleText
                      : isAdmin
                      ? styles.adminRoleText
                      : styles.workerRoleText,
                  ]}
                >
                  {isMainAdmin
                    ? 'Main Administrator (Super Admin)'
                    : isAdmin
                    ? 'Gram Panchayat Admin'
                    : 'Field Worker'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Gram Panchayat Details Card */}
        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons
              name="business-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.cardSectionTitle}>Gram Panchayat Details</Text>
          </View>

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Panchayat Name</Text>
              <Text style={styles.detailValue}>{gpName}</Text>
            </View>

            {village ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Village</Text>
                <Text style={styles.detailValue}>{village}</Text>
              </View>
            ) : null}

            {block ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Block / Taluka</Text>
                <Text style={styles.detailValue}>{block}</Text>
              </View>
            ) : null}

            {district ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>District</Text>
                <Text style={styles.detailValue}>{district}</Text>
              </View>
            ) : null}

            {state ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>State</Text>
                <Text style={styles.detailValue}>{state}</Text>
              </View>
            ) : null}

            {isAdmin && gp?.upiId ? (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Water Tax UPI ID</Text>
                <Text style={[styles.detailValue, { color: colors.primary }]}>
                  {gp.upiId}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 3. Admin Shortcuts */}
        {isAdmin ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name="settings-outline"
                size={18}
                color={colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.cardSectionTitle}>Admin Administration</Text>
            </View>

            <TouchableOpacity
              style={styles.shortcutRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ManageWorkers')}
              accessibilityRole="button"
              accessibilityLabel="Manage field workers"
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: tones.neutral.bg }]}>
                <Ionicons name="people" size={20} color={tones.neutral.fg} />
              </View>
              <View style={styles.shortcutTextBox}>
                <Text style={styles.shortcutTitle}>Manage Field Workers</Text>
                <Text style={styles.shortcutSubtitle}>
                  View staff list, add accounts & toggle logins
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>

            {/* Pending GP Approvals Section - Only visible to Main Admin (9992934154) */}
            {isMainAdmin && pendingGps && pendingGps.length > 0 ? (
              <View style={styles.pendingGpsContainer}>
                <View style={styles.pendingGpsHeader}>
                  <Ionicons name="time" size={16} color={tones.warning.fg} style={{ marginRight: 6 }} />
                  <Text style={styles.pendingGpsTitle}>
                    Pending GP Approvals ({pendingGps.length})
                  </Text>
                </View>

                {pendingGps.map((pGp) => (
                  <View key={pGp.id} style={styles.pendingGpCard}>
                    <View style={styles.pendingGpInfo}>
                      <Text style={styles.pendingGpName}>{pGp.name}</Text>
                      <Text style={styles.pendingGpLocation}>
                        {pGp.village}, {pGp.district} ({pGp.state})
                      </Text>
                      {pGp.admin ? (
                        <Text style={styles.pendingGpAdmin}>
                          Admin: {pGp.admin.name} • {pGp.admin.phone}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.gpActionButtonsRow}>
                      <TouchableOpacity
                        style={[
                          styles.rejectButton,
                          (approvingId === pGp.id || rejectSubmitting) && styles.disabledApproveButton,
                        ]}
                        onPress={() => openRejectModal(pGp)}
                        disabled={approvingId === pGp.id || rejectSubmitting}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.rejectButtonText}>Decline</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.approveButton,
                          approvingId === pGp.id && styles.disabledApproveButton,
                        ]}
                        onPress={() => handleApproveGp(pGp)}
                        disabled={approvingId === pGp.id || rejectSubmitting}
                        activeOpacity={0.8}
                      >
                        {approvingId === pGp.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.approveButtonText}>Approve</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Gram Panchayat Activity Monitor - ONLY for Main Admin */}
            {isMainAdmin && allGps && allGps.length > 0 ? (
              <View style={styles.monitorContainer}>
                <View style={styles.monitorHeaderRow}>
                  <Ionicons name="business" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.monitorTitle}>
                    Gram Panchayat Activity Monitor ({allGps.length})
                  </Text>
                </View>
                <Text style={styles.monitorSubtitle}>
                  Real-time operational activity across all registered Gram Panchayats
                </Text>

                {allGps.map((g) => (
                  <View key={g.id} style={styles.monitorGpCard}>
                    <View style={styles.monitorCardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.monitorGpName}>{g.name}</Text>
                        <Text style={styles.monitorGpLocation}>
                          {g.village}, {g.district} • {g.state}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusPillSmall,
                          { backgroundColor: g.isApproved ? tones.success.bg : tones.warning.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillSmallText,
                            { color: g.isApproved ? tones.success.fg : tones.warning.fg },
                          ]}
                        >
                          {g.isApproved ? 'APPROVED' : 'PENDING'}
                        </Text>
                      </View>
                    </View>

                    {g.admin ? (
                      <Text style={styles.monitorAdminText}>
                        Admin: {g.admin.name} • {g.admin.phone}
                      </Text>
                    ) : null}

                    {/* Operational Stats Grid */}
                    <View style={styles.statsPillRow}>
                      <View style={styles.statMiniChip}>
                        <Text style={styles.statMiniLabel}>Assets</Text>
                        <Text style={styles.statMiniValue}>
                          {g.stats.totalAssets}
                          {g.stats.faultyAssets > 0 ? (
                            <Text style={{ color: tones.danger.fg }}> ({g.stats.faultyAssets} faulty)</Text>
                          ) : null}
                        </Text>
                      </View>

                      <View style={styles.statMiniChip}>
                        <Text style={styles.statMiniLabel}>Workers</Text>
                        <Text style={styles.statMiniValue}>{g.stats.workersCount}</Text>
                      </View>

                      <View style={styles.statMiniChip}>
                        <Text style={styles.statMiniLabel}>Consumers</Text>
                        <Text style={styles.statMiniValue}>{g.stats.totalConsumers}</Text>
                      </View>

                      <View style={styles.statMiniChip}>
                        <Text style={styles.statMiniLabel}>Collected</Text>
                        <Text style={styles.statMiniValue}>
                          ₹{Math.round((g.stats.totalCollectedPaise || 0) / 100).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 4. App & Support Information */}
        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.muted}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.cardSectionTitle}>About JalKosh</Text>
          </View>

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Application Version</Text>
              <Text style={styles.detailValue}>v1.0.0 (Release)</Text>
            </View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Scheme Compliance</Text>
              <Text style={styles.detailValue}>Jal Jeevan Mission (JJM)</Text>
            </View>
          </View>
        </View>

        {/* 5. Prominent Logout Action */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out of JalKosh"
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.white}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

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
                  rejectSubmitting && styles.disabledApproveButton,
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
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  adminAvatar: {
    backgroundColor: colors.primary,
  },
  workerAvatar: {
    backgroundColor: '#0F766E', // rich teal
  },
  userAvatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
  },
  identityTextContainer: {
    flex: 1,
  },
  userNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  phoneText: {
    fontSize: 14,
    color: colors.muted,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  adminRoleBadge: {
    backgroundColor: tones.info.bg,
  },
  mainAdminRoleBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  mainAdminRoleText: {
    color: '#92400E',
    fontWeight: '700',
  },
  workerRoleBadge: {
    backgroundColor: tones.success.bg,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adminRoleText: {
    color: tones.info.fg,
  },
  workerRoleText: {
    color: tones.success.fg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  detailList: {
    marginTop: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  shortcutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  shortcutTextBox: {
    flex: 1,
  },
  shortcutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  shortcutSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  pendingGpsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pendingGpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pendingGpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tones.warning.fg,
  },
  pendingGpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginBottom: spacing.xs + 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingGpInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  pendingGpName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  pendingGpLocation: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  pendingGpAdmin: {
    fontSize: 11,
    color: colors.text,
    marginTop: 2,
  },
  gpActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rejectButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  approveButton: {
    backgroundColor: colors.success || '#16A34A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  disabledApproveButton: {
    opacity: 0.6,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Monitor styles
  monitorContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  monitorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monitorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  monitorSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  monitorGpCard: {
    backgroundColor: '#F8FAFC',
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monitorCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monitorGpName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  monitorGpLocation: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  statusPillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusPillSmallText: {
    fontSize: 9,
    fontWeight: '700',
  },
  monitorAdminText: {
    fontSize: 11,
    color: colors.text,
    marginBottom: 6,
  },
  statsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statMiniChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statMiniLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  statMiniValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginTop: 1,
  },
  // Modal styles for decline
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
    marginVertical: spacing.sm,
  },
  modalErrorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    minHeight: 90,
    backgroundColor: '#F9FAFB',
    marginBottom: spacing.md,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
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
    borderRadius: radius.md,
    minWidth: 140,
    alignItems: 'center',
  },
  modalConfirmDeclineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  bottomSpacer: {
    height: spacing.xl * 2,
  },
});
