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
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { colors, tones, spacing, radius } from '../theme';

export default function ProfileScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const gp = useAuthStore((state) => state.gp);
  const logout = useAuthStore((state) => state.logout);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const [refreshing, setRefreshing] = useState(false);

  // Sync profile data on pull-to-refresh or focus
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof fetchProfile === 'function') {
        await fetchProfile();
      }
    } catch (err) {
      // Handled by 401 interceptor if expired
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      if (typeof fetchProfile === 'function') {
        fetchProfile().catch(() => {});
      }
    }, [fetchProfile])
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
                  isAdmin ? styles.adminRoleBadge : styles.workerRoleBadge,
                ]}
              >
                <Ionicons
                  name={isAdmin ? 'shield-checkmark' : 'construct'}
                  size={13}
                  color={isAdmin ? tones.info.fg : tones.success.fg}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.roleBadgeText,
                    isAdmin ? styles.adminRoleText : styles.workerRoleText,
                  ]}
                >
                  {isAdmin ? 'Gram Panchayat Admin' : 'Field Worker'}
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
