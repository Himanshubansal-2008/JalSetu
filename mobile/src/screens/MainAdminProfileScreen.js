/**
 * MainAdminProfileScreen.js
 * Profile, platform governance, and system settings panel for Main Administrator.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { colors, tones, spacing, radius } from '../theme';

export default function MainAdminProfileScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [resetting, setResetting] = useState(false);

  // Logout action with native confirmation
  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Log out of Main Administrator mode on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (_) {}
          },
        },
      ]
    );
  };

  // Reset all demo data action
  const handleResetDemoData = () => {
    Alert.alert(
      'Reset Demo Datasets',
      'This will re-initialize the demo dataset (Gram Panchayat Shirur, 15 assets, 8 inventory items, 20 consumers, and financial entries) to a clean starting state.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Dataset',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              await apiClient.post('/admin/demo/reset');
              Alert.alert('Reset Complete', 'Demo datasets have been reset successfully to clean initial state!');
            } catch (err) {
              Alert.alert('Reset Failed', getErrorMessage(err));
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>System & Profile Settings</Text>
        <Text style={styles.headerSubtitle}>
          Platform Super Administrator Governance
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="shield" size={32} color="#FFFFFF" />
          </View>

          <View style={styles.identityDetails}>
            <Text style={styles.userName}>{user?.name || 'Main Administrator'}</Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={colors.muted} style={{ marginRight: 4 }} />
              <Text style={styles.phoneText}>{user?.phone || ''}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#92400E" style={{ marginRight: 4 }} />
              <Text style={styles.roleBadgeText}>PLATFORM SUPER ADMIN</Text>
            </View>
          </View>
        </View>

        {/* Administration Privileges Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="key-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>Super Admin Privileges</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Your account has state-level administrative authority across JalSetu:
          </Text>

          <View style={styles.privilegeItem}>
            <Ionicons name="checkmark-circle" size={18} color={tones.success.fg} style={{ marginRight: 8 }} />
            <Text style={styles.privilegeText}>Sole authority to approve or decline incoming Gram Panchayat signups</Text>
          </View>

          <View style={styles.privilegeItem}>
            <Ionicons name="checkmark-circle" size={18} color={tones.success.fg} style={{ marginRight: 8 }} />
            <Text style={styles.privilegeText}>State-wide real-time operational monitor across all Gram Panchayats</Text>
          </View>

          <View style={styles.privilegeItem}>
            <Ionicons name="checkmark-circle" size={18} color={tones.success.fg} style={{ marginRight: 8 }} />
            <Text style={styles.privilegeText}>Audit logs & water security compliance monitoring (Jal Jeevan Mission)</Text>
          </View>
        </View>

        {/* Quick Management Shortcuts */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="navigate-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>Command Shortcuts</Text>
          </View>

          <TouchableOpacity
            style={styles.shortcutRow}
            onPress={() => navigation.navigate('ApprovalsTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={18} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shortcutTitle}>Pending Approvals Queue</Text>
              <Text style={styles.shortcutDesc}>Review and verify incoming Gram Panchayats</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutRow, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('PanchayatsTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: tones.info.bg }]}>
              <Ionicons name="business" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shortcutTitle}>Panchayat Directory</Text>
              <Text style={styles.shortcutDesc}>Inspect operations, staff, and tax revenue</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* System & Maintenance Actions */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="settings-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>System Maintenance</Text>
          </View>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetDemoData}
            disabled={resetting}
            activeOpacity={0.8}
          >
            {resetting ? (
              <ActivityIndicator size="small" color="#B45309" />
            ) : (
              <>
                <Ionicons name="refresh-circle" size={20} color="#B45309" style={{ marginRight: 8 }} />
                <Text style={styles.resetButtonText}>Reset Demo Datasets to Default</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Action */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
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
  scrollContent: {
    padding: spacing.lg,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#B45309', // amber/gold
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  identityDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  phoneText: {
    fontSize: 13,
    color: colors.muted,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  privilegeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm + 2,
  },
  privilegeText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  shortcutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  shortcutDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: radius.sm,
    paddingVertical: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
