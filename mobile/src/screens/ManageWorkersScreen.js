/**
 * ManageWorkersScreen.js
 * Admin-only screen for managing Gram Panchayat field workers.
 *
 * Capabilities:
 * - Admin-only route guard (blocks non-admins without calling API)
 * - Lists GP workers via GET /api/workers with pull-to-refresh
 * - One-tap Activate / Deactivate with native Alert confirmation & double-tap lock
 * - Status badges (Active vs. Deactivated) with dimmed styling for inactive accounts
 * - Modal form to register new field workers (POST /api/workers) with temporary password
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { colors, tones, spacing, radius } from '../theme';

export default function ManageWorkersScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  // Workers data & list states
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // In-flight status toggle lock
  const [updatingWorkerId, setUpdatingWorkerId] = useState(null);

  // Add Worker Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const hasDataRef = useRef(false);
  const requestIdRef = useRef(0);

  // Fetch workers list: GET /api/workers
  const fetchWorkers = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!isAdmin) return;

      const currentReqId = ++requestIdRef.current;
      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setLoading(true);
      }
      setError('');

      try {
        const response = await apiClient.get('/workers');
        if (currentReqId === requestIdRef.current) {
          const list = response.data?.workers || [];
          setWorkers(list);
          hasDataRef.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      } catch (err) {
        if (currentReqId === requestIdRef.current) {
          const errMsg = getErrorMessage(err, 'Failed to load workers');
          setError(errMsg);
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [isAdmin]
  );

  // Focus effect for re-fetching
  useFocusEffect(
    useCallback(() => {
      fetchWorkers();
    }, [fetchWorkers])
  );

  const handleRefresh = useCallback(() => {
    fetchWorkers({ isRefresh: true });
  }, [fetchWorkers]);

  // Activate / Deactivate status toggle with confirmation
  const handleToggleStatus = useCallback(
    (worker) => {
      if (!worker || updatingWorkerId === worker.id) return;

      const willActivate = !worker.isActive;

      if (willActivate) {
        Alert.alert(
          'Activate Worker',
          `Re-activate ${worker.name}? They will regain access to log in and record operations.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Activate',
              onPress: () => mutateWorkerStatus(worker.id, true, worker.name),
            },
          ]
        );
      } else {
        Alert.alert(
          'Deactivate Worker',
          `Deactivate ${worker.name}? They will immediately lose app access and cannot log in.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Deactivate',
              style: 'destructive',
              onPress: () => mutateWorkerStatus(worker.id, false, worker.name),
            },
          ]
        );
      }
    },
    [updatingWorkerId]
  );

  const mutateWorkerStatus = async (workerId, nextStatus, workerName) => {
    setUpdatingWorkerId(workerId);
    try {
      const response = await apiClient.patch(`/workers/${workerId}/status`, {
        isActive: nextStatus,
      });

      const updated = response.data?.worker;
      // Optimistically update list
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId ? { ...w, isActive: updated ? updated.isActive : nextStatus } : w
        )
      );
    } catch (err) {
      const errMsg = getErrorMessage(err, 'Failed to update worker status');
      Alert.alert('Status Update Failed', errMsg);
      fetchWorkers();
    } finally {
      setUpdatingWorkerId(null);
    }
  };

  // Submit new worker registration: POST /api/workers
  const handleAddWorker = async () => {
    const cleanName = newName.trim();
    const cleanPhone = newPhone.trim().replace(/\D/g, '');
    const cleanPassword = newPassword;

    // Validation
    if (!cleanName) {
      setModalError('Please enter worker full name.');
      return;
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      setModalError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setModalError('Temporary password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const response = await apiClient.post('/workers', {
        name: cleanName,
        phone: cleanPhone,
        password: cleanPassword,
      });

      // Close modal and reset form
      setModalVisible(false);
      setNewName('');
      setNewPhone('');
      setNewPassword('');
      setShowPassword(false);
      setSubmitting(false);

      const created = response.data?.worker || response.data?.user;
      Alert.alert(
        'Worker Registered',
        `Worker account for "${created?.name || cleanName}" created successfully! Please share the temporary credentials with the worker.`
      );

      // Refresh workers list
      fetchWorkers();
    } catch (err) {
      setSubmitting(false);
      const errMsg = getErrorMessage(err, 'Failed to create worker account');
      setModalError(errMsg);
    }
  };

  const openAddModal = () => {
    setNewName('');
    setNewPhone('');
    setNewPassword('');
    setShowPassword(false);
    setModalError('');
    setModalVisible(true);
  };

  // 1. Admin-Only Route Guard Screen
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Access Restricted</Text>
        </View>

        <View style={styles.guardContainer}>
          <View style={styles.guardIconBox}>
            <Ionicons name="lock-closed" size={48} color={tones.danger.fg} />
          </View>
          <Text style={styles.guardTitle}>Admin Access Required</Text>
          <Text style={styles.guardMessage}>
            Only Gram Panchayat administrators have permission to manage field workers and account access.
          </Text>
          <TouchableOpacity
            style={styles.guardBackButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.guardBackText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Main Admin View
  const activeCount = workers.filter((w) => w.isActive).length;
  const inactiveCount = workers.length - activeCount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header Bar */}
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

        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>Manage Workers</Text>
          <Text style={styles.navSubtitle}>
            {workers.length > 0
              ? `${activeCount} active · ${inactiveCount} deactivated`
              : 'Gram Panchayat staff'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addHeaderButton}
          onPress={openAddModal}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add new worker"
        >
          <Ionicons name="person-add" size={16} color={colors.white} style={{ marginRight: 4 }} />
          <Text style={styles.addHeaderButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Main List Container */}
      <View style={styles.container}>
        {/* Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color={tones.danger.fg} style={{ marginRight: 8 }} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={() => fetchWorkers()} style={styles.retryPill}>
              <Text style={styles.retryPillText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading Spinner */}
        {loading && !workers.length ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading field workers...</Text>
          </View>
        ) : (
          <FlatList
            data={workers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              !loading && (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBox}>
                    <Ionicons name="people-outline" size={48} color={colors.muted} />
                  </View>
                  <Text style={styles.emptyTitle}>No field workers added yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Add pump operators, linemen, and maintenance staff to grant them field app access.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyAddButton}
                    onPress={openAddModal}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add" size={16} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.emptyAddButtonText}>+ Add First Worker</Text>
                  </TouchableOpacity>
                </View>
              )
            }
            renderItem={({ item }) => {
              const isUpdating = updatingWorkerId === item.id;
              const isActive = Boolean(item.isActive);

              return (
                <View
                  style={[
                    styles.workerCard,
                    !isActive && styles.inactiveWorkerCard,
                  ]}
                >
                  {/* Left: Avatar */}
                  <View
                    style={[
                      styles.workerAvatar,
                      isActive ? styles.activeAvatar : styles.inactiveAvatar,
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        isActive ? styles.activeAvatarText : styles.inactiveAvatarText,
                      ]}
                    >
                      {(item.name || 'W').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* Middle: Details */}
                  <View style={styles.workerDetails}>
                    <View style={styles.workerNameRow}>
                      <Text
                        style={[
                          styles.workerName,
                          !isActive && styles.inactiveText,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>

                    <View style={styles.workerPhoneRow}>
                      <Ionicons
                        name="call-outline"
                        size={13}
                        color={isActive ? colors.muted : colors.border}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.workerPhone,
                          !isActive && styles.inactiveText,
                        ]}
                      >
                        {item.phone}
                      </Text>
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.statusPill,
                        isActive ? styles.activeStatusPill : styles.inactiveStatusPill,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          isActive ? styles.activeDot : styles.inactiveDot,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          isActive ? styles.activeStatusText : styles.inactiveStatusText,
                        ]}
                      >
                        {isActive ? 'Active' : 'Deactivated'}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Toggle Button */}
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      isActive ? styles.deactivateButton : styles.activateButton,
                      isUpdating && styles.disabledButton,
                    ]}
                    onPress={() => handleToggleStatus(item)}
                    disabled={isUpdating}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={isActive ? `Deactivate ${item.name}` : `Activate ${item.name}`}
                  >
                    {isUpdating ? (
                      <ActivityIndicator
                        size="small"
                        color={isActive ? tones.danger.fg : tones.success.fg}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.toggleButtonText,
                          isActive ? styles.deactivateButtonText : styles.activateButtonText,
                        ]}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* 3. Add Worker Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!submitting) setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add New Worker</Text>
                <Text style={styles.modalSubtitle}>
                  Create login account for field staff
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={submitting}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalBody}
            >
              {/* Error banner inside modal */}
              {modalError ? (
                <View style={styles.modalErrorBox}>
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={tones.danger.fg}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.modalErrorText}>{modalError}</Text>
                </View>
              ) : null}

              {/* Full Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Full Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Vikas Shinde (Operator)"
                    placeholderTextColor={colors.muted}
                    value={newName}
                    onChangeText={(val) => {
                      setNewName(val);
                      if (modalError) setModalError('');
                    }}
                    autoCapitalize="words"
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* Phone Number Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Phone Number <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.muted}
                    value={newPhone}
                    onChangeText={(val) => {
                      setNewPhone(val);
                      if (modalError) setModalError('');
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* Temporary Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Temporary Password <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="key-outline"
                    size={18}
                    color={colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { paddingRight: 40 }]}
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.muted}
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (modalError) setModalError('');
                    }}
                    secureTextEntry={!showPassword}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>
                  Share this temporary password with the worker so they can log in.
                </Text>
              </View>

              {/* Submit Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    submitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleAddWorker}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <View style={styles.submittingRow}>
                      <ActivityIndicator size="small" color={colors.white} style={{ marginRight: 8 }} />
                      <Text style={styles.submitButtonText}>Adding Worker...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitButtonText}>Register Worker</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  container: {
    flex: 1,
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
  navTitleContainer: {
    flex: 1,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  navSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  addHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addHeaderButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.muted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F8B4B4',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: tones.danger.fg,
  },
  retryPill: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tones.danger.fg,
  },
  retryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inactiveWorkerCard: {
    opacity: 0.72,
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activeAvatar: {
    backgroundColor: tones.info.bg,
  },
  inactiveAvatar: {
    backgroundColor: tones.neutral.bg,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  activeAvatarText: {
    color: tones.info.fg,
  },
  inactiveAvatarText: {
    color: colors.muted,
  },
  workerDetails: {
    flex: 1,
    marginRight: spacing.sm,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  workerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  workerPhone: {
    fontSize: 13,
    color: colors.muted,
  },
  inactiveText: {
    color: colors.muted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  activeStatusPill: {
    backgroundColor: tones.success.bg,
  },
  inactiveStatusPill: {
    backgroundColor: tones.danger.bg,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  activeDot: {
    backgroundColor: tones.success.fg,
  },
  inactiveDot: {
    backgroundColor: tones.danger.fg,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeStatusText: {
    color: tones.success.fg,
  },
  inactiveStatusText: {
    color: tones.danger.fg,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deactivateButton: {
    backgroundColor: tones.danger.bg,
    borderColor: '#F8B4B4',
  },
  activateButton: {
    backgroundColor: tones.success.bg,
    borderColor: '#A7F3D0',
  },
  disabledButton: {
    opacity: 0.6,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deactivateButtonText: {
    color: tones.danger.fg,
  },
  activateButtonText: {
    color: tones.success.fg,
  },
  emptyContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tones.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  emptyAddButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  guardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  guardIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tones.danger.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  guardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  guardMessage: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  guardBackButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  guardBackText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.md * 1.5,
    borderTopRightRadius: radius.md * 1.5,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F8B4B4',
  },
  modalErrorText: {
    flex: 1,
    fontSize: 13,
    color: tones.danger.fg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  requiredStar: {
    color: colors.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: colors.text,
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  submitButton: {
    flex: 2,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
