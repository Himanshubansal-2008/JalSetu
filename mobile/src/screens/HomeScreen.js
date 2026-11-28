/**
 * HomeScreen.js (DashboardScreen)
 * Role-aware Home Dashboard for the JalKosh mobile app powered by GET /api/dashboard.
 *
 * Scoped strictly to the logged-in user's Gram Panchayat.
 * - Admin view: System operational metrics (Assets, Low-Stock items),
 *   Financial & Billing metrics (Income, Expense, Net Balance, Pending Dues),
 *   and Admin Quick Actions (Add Asset, Record Expense, Generate Bills).
 * - Worker view: Clean field-operations view with zero financial/rupee leakage,
 *   tappable field status cards (Faulty Assets, Low-Stock Consumables, Under Repair),
 *   and Field Quick Actions (Add Asset, Add Note / Report Fault, Use Stock).
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { formatPaiseToRupees } from '../utils/currency';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';

// Formats "YYYY-MM" to readable "November 2026"
function formatMonthName(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return '';
  const [yStr, mStr] = monthStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  if (isNaN(year) || isNaN(month)) return monthStr;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function HomeScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const authGp = useAuthStore((state) => state.gp);
  const logout = useAuthStore((state) => state.logout);

  const role = (user?.role || '').toLowerCase();
  const isMainAdmin = role === 'main_admin' || Boolean(user?.isMainAdmin);
  const isAdmin = role === 'admin' || isMainAdmin;

  // Dashboard data and UI states
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const hasDataRef = useRef(false);
  const requestIdRef = useRef(0);

  // Fetch dashboard data from GET /api/dashboard
  const fetchDashboard = useCallback(
    async ({ isRefresh = false } = {}) => {
      const currentReqId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setLoading(true);
      }
      setError('');

      try {
        const response = await apiClient.get('/dashboard');
        if (currentReqId === requestIdRef.current) {
          setDashboard(response.data);
          hasDataRef.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      } catch (err) {
        if (currentReqId === requestIdRef.current) {
          const errMsg = getErrorMessage(err, 'Failed to load dashboard metrics');
          setError(errMsg);
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  // Re-fetch data on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const handleRefresh = useCallback(() => {
    fetchDashboard({ isRefresh: true });
  }, [fetchDashboard]);

  // Safe navigation helper that handles nested stack transitions
  const navigateTo = useCallback(
    (tabName, screenName, params) => {
      try {
        navigation.navigate(tabName, {
          screen: screenName,
          params,
        });
      } catch (e) {
        navigation.navigate(screenName, params);
      }
    },
    [navigation]
  );

  // Confirm logout
  const handleLogout = useCallback(() => {
    Alert.alert(
      strings.logout || 'Log Out',
      'Are you sure you want to log out of JalKosh?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: strings.logout || 'Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  }, [logout]);

  // Metadata resolution
  const gpName =
    dashboard?.gp?.name ||
    authGp?.name ||
    user?.gp?.name ||
    user?.gpName ||
    'Gram Panchayat';

  const gpLocation =
    dashboard?.gp?.village ||
    authGp?.village ||
    dashboard?.gp?.district ||
    authGp?.district ||
    '';

  const monthLabel = formatMonthName(dashboard?.month);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Top Greeting & Profile Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.gpInfoContainer}>
            <View style={styles.gpBadgeRow}>
              <Ionicons name="location-sharp" size={14} color={colors.primary} />
              <Text style={styles.gpNameText} numberOfLines={1}>
                {gpName}
              </Text>
            </View>
            {gpLocation ? (
              <Text style={styles.gpLocationText} numberOfLines={1}>
                {gpLocation}
              </Text>
            ) : null}
          </View>

          {/* Right Header Controls (Workers, Refresh, Profile & Logout) */}
          <View style={styles.headerActions}>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ManageWorkers')}
                style={styles.iconButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Manage field workers"
              >
                <Ionicons name="people-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={styles.iconButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Profile and settings"
            >
              <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.iconButton, styles.logoutIconButton]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* User Greeting & Role Badge Row (Tappable to Profile) */}
        <TouchableOpacity
          style={styles.greetingRow}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile and settings"
        >
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userNameContainer}>
            <Text style={styles.greetingSub}>Namaste,</Text>
            <Text style={styles.userNameText} numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
          </View>
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
              {isAdmin ? 'Admin' : 'Field Worker'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
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
        {/* Loading State */}
        {loading && !dashboard ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading dashboard metrics...</Text>
          </View>
        ) : null}

        {/* Error Banner with Retry */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={colors.danger}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Could not load dashboard</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </View>
            <TouchableOpacity
              onPress={() => fetchDashboard()}
              style={styles.retryButton}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {dashboard ? (
          isAdmin ? (
            /* ============================================================== */
            /* ==================== ADMIN DASHBOARD VIEW ==================== */
            /* ============================================================== */
            <View style={styles.viewSection}>
              {/* SECTION 1: Operational Metrics (Assets & Inventory) */}
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Water Supply Operations</Text>
                  <Text style={styles.sectionSubtitle}>
                    Assets & consumable inventory status
                  </Text>
                </View>
              </View>

              <View style={styles.grid2x2}>
                {/* 1. Total Assets */}
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetList')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Total assets: ${dashboard.assets?.total || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIconBox, { backgroundColor: tones.info.bg }]}>
                      <Ionicons name="cube-outline" size={20} color={tones.info.fg} />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text style={styles.cardValue}>{dashboard.assets?.total ?? 0}</Text>
                  <Text style={styles.cardLabel}>Total Assets</Text>
                  <Text style={styles.cardSubText}>Pumps, sources & lines</Text>
                </TouchableOpacity>

                {/* 2. Faulty Assets (highlighted when > 0) */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    (dashboard.assets?.faulty || 0) > 0 && styles.cardDangerHighlight,
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetList', {
                      initialStatus: 'FAULTY',
                      status: 'FAULTY',
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Faulty assets: ${dashboard.assets?.faulty || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.assets?.faulty || 0) > 0
                              ? tones.danger.bg
                              : tones.neutral.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="alert-circle"
                        size={20}
                        color={
                          (dashboard.assets?.faulty || 0) > 0
                            ? tones.danger.fg
                            : colors.muted
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardValue,
                      (dashboard.assets?.faulty || 0) > 0 && { color: tones.danger.fg },
                    ]}
                  >
                    {dashboard.assets?.faulty ?? 0}
                  </Text>
                  <Text style={styles.cardLabel}>Faulty Assets</Text>
                  <Text
                    style={[
                      styles.cardSubText,
                      (dashboard.assets?.faulty || 0) > 0 && {
                        color: tones.danger.fg,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {(dashboard.assets?.faulty || 0) > 0
                      ? 'Requires attention'
                      : 'All operational'}
                  </Text>
                </TouchableOpacity>

                {/* 3. Under Repair Assets */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    (dashboard.assets?.underRepair || 0) > 0 && styles.cardWarningHighlight,
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetList', {
                      initialStatus: 'UNDER_REPAIR',
                      status: 'UNDER_REPAIR',
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Under repair assets: ${dashboard.assets?.underRepair || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.assets?.underRepair || 0) > 0
                              ? tones.warning.bg
                              : tones.neutral.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="construct-outline"
                        size={20}
                        color={
                          (dashboard.assets?.underRepair || 0) > 0
                            ? tones.warning.fg
                            : colors.muted
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardValue,
                      (dashboard.assets?.underRepair || 0) > 0 && {
                        color: tones.warning.fg,
                      },
                    ]}
                  >
                    {dashboard.assets?.underRepair ?? 0}
                  </Text>
                  <Text style={styles.cardLabel}>Under Repair</Text>
                  <Text style={styles.cardSubText}>
                    {(dashboard.assets?.underRepair || 0) > 0
                      ? 'Active servicing'
                      : 'None under repair'}
                  </Text>
                </TouchableOpacity>

                {/* 4. Low-Stock Items (highlighted when > 0) */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    (dashboard.lowStockCount || 0) > 0 && styles.cardWarningHighlight,
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.inventory, 'InventoryList', {
                      lowStockOnly: true,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Low stock items: ${dashboard.lowStockCount || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.lowStockCount || 0) > 0
                              ? tones.warning.bg
                              : tones.neutral.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="file-tray-stacked-outline"
                        size={20}
                        color={
                          (dashboard.lowStockCount || 0) > 0
                            ? tones.warning.fg
                            : colors.muted
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardValue,
                      (dashboard.lowStockCount || 0) > 0 && {
                        color: tones.warning.fg,
                      },
                    ]}
                  >
                    {dashboard.lowStockCount ?? 0}
                  </Text>
                  <Text style={styles.cardLabel}>Low-Stock Items</Text>
                  <Text
                    style={[
                      styles.cardSubText,
                      (dashboard.lowStockCount || 0) > 0 && {
                        color: tones.warning.fg,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {(dashboard.lowStockCount || 0) > 0
                      ? 'Below reorder level'
                      : 'Stock levels healthy'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SECTION 2: Finance & Billing Overview (Admin Only) */}
              <View style={[styles.sectionHeaderRow, { marginTop: spacing.xl }]}>
                <View>
                  <Text style={styles.sectionTitle}>Finance & Billing Overview</Text>
                  <Text style={styles.sectionSubtitle}>
                    {monthLabel ? `Monthly figures for ${monthLabel}` : 'Monthly figures'}
                  </Text>
                </View>
              </View>

              <View style={styles.grid2x2}>
                {/* 1. This Month's Income */}
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.finance, 'MonthlySummary')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`This month's income: ${formatPaiseToRupees(
                    dashboard.finance?.incomePaise
                  )}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        { backgroundColor: tones.success.bg },
                      ]}
                    >
                      <Ionicons
                        name="arrow-down-circle"
                        size={20}
                        color={tones.success.fg}
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardCurrencyValue,
                      { color: tones.success.fg },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatPaiseToRupees(dashboard.finance?.incomePaise)}
                  </Text>
                  <Text style={styles.cardLabel}>This Month's Income</Text>
                  <Text style={styles.cardSubText}>Water taxes & grants</Text>
                </TouchableOpacity>

                {/* 2. This Month's Expense */}
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.finance, 'CashBook')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`This month's expense: ${formatPaiseToRupees(
                    dashboard.finance?.expensePaise
                  )}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        { backgroundColor: tones.danger.bg },
                      ]}
                    >
                      <Ionicons
                        name="arrow-up-circle"
                        size={20}
                        color={tones.danger.fg}
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[styles.cardCurrencyValue, { color: tones.danger.fg }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatPaiseToRupees(dashboard.finance?.expensePaise)}
                  </Text>
                  <Text style={styles.cardLabel}>This Month's Expense</Text>
                  <Text style={styles.cardSubText}>Repairs, power & wages</Text>
                </TouchableOpacity>

                {/* 3. Net Month Balance */}
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.finance, 'CashBook')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Net balance: ${formatPaiseToRupees(
                    dashboard.finance?.balancePaise
                  )}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.finance?.balancePaise || 0) >= 0
                              ? tones.info.bg
                              : tones.danger.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="wallet-outline"
                        size={20}
                        color={
                          (dashboard.finance?.balancePaise || 0) >= 0
                            ? tones.info.fg
                            : tones.danger.fg
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardCurrencyValue,
                      {
                        color:
                          (dashboard.finance?.balancePaise || 0) >= 0
                            ? colors.text
                            : tones.danger.fg,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatPaiseToRupees(dashboard.finance?.balancePaise)}
                  </Text>
                  <Text style={styles.cardLabel}>Net Month Balance</Text>
                  <Text style={styles.cardSubText}>Cash book net flow</Text>
                </TouchableOpacity>

                {/* 4. Pending Dues (highlighted when unpaidCount > 0) */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    (dashboard.pendingDues?.unpaidCount || 0) > 0 &&
                      styles.cardWarningHighlight,
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.consumers, 'BillsList', {
                      initialStatus: 'PENDING',
                      status: 'PENDING',
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Pending dues: ${formatPaiseToRupees(
                    dashboard.pendingDues?.amountPaise
                  )}, ${dashboard.pendingDues?.unpaidCount || 0} unpaid bills`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.pendingDues?.unpaidCount || 0) > 0
                              ? tones.warning.bg
                              : tones.neutral.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="receipt-outline"
                        size={20}
                        color={
                          (dashboard.pendingDues?.unpaidCount || 0) > 0
                            ? tones.warning.fg
                            : colors.muted
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardCurrencyValue,
                      (dashboard.pendingDues?.unpaidCount || 0) > 0 && {
                        color: tones.warning.fg,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatPaiseToRupees(dashboard.pendingDues?.amountPaise)}
                  </Text>
                  <Text style={styles.cardLabel}>Pending Dues</Text>
                  <Text
                    style={[
                      styles.cardSubText,
                      (dashboard.pendingDues?.unpaidCount || 0) > 0 && {
                        color: tones.warning.fg,
                        fontWeight: '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {dashboard.pendingDues?.unpaidCount
                      ? `${dashboard.pendingDues.unpaidCount} unpaid bills`
                      : 'No unpaid bills'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SECTION 3: Admin Quick Actions */}
              <View style={[styles.sectionHeaderRow, { marginTop: spacing.xl }]}>
                <View>
                  <Text style={styles.sectionTitle}>Quick Actions</Text>
                  <Text style={styles.sectionSubtitle}>
                    Frequent administration workflows
                  </Text>
                </View>
              </View>

              <View style={styles.quickActionsList}>
                {/* Action 1: Add Asset */}
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetForm')
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Add new asset"
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      { backgroundColor: tones.info.bg },
                    ]}
                  >
                    <Ionicons name="add-circle" size={24} color={tones.info.fg} />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>Add Asset</Text>
                    <Text style={styles.actionSubtitle}>
                      Register new water pump, borewell, or pipeline
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>

                {/* Action 2: Record Expense */}
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigateTo(strings.finance, 'FinanceEntryForm', {
                      initialType: 'EXPENSE',
                      mode: 'EXPENSE',
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Record expense"
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      { backgroundColor: tones.danger.bg },
                    ]}
                  >
                    <Ionicons
                      name="remove-circle"
                      size={24}
                      color={tones.danger.fg}
                    />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>Record Expense</Text>
                    <Text style={styles.actionSubtitle}>
                      Log pipeline repair, electricity bill, or material purchase
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>

                {/* Action 3: Generate Bills */}
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigateTo(strings.consumers, 'BillsList')
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Generate monthly bills"
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      { backgroundColor: tones.warning.bg },
                    ]}
                  >
                    <Ionicons name="receipt" size={24} color={tones.warning.fg} />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>Generate Bills</Text>
                    <Text style={styles.actionSubtitle}>
                      Run monthly water tariff generation for active consumers
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>

                {/* Action 4: Manage Workers */}
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('ManageWorkers')}
                  accessibilityRole="button"
                  accessibilityLabel="Manage field workers"
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      { backgroundColor: tones.neutral.bg },
                    ]}
                  >
                    <Ionicons name="people" size={24} color={tones.neutral.fg} />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>Manage Workers</Text>
                    <Text style={styles.actionSubtitle}>
                      Add, activate, or deactivate field worker logins
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ============================================================== */
            /* =================== WORKER DASHBOARD VIEW ==================== */
            /* ============================================================== */
            <View style={styles.viewSection}>
              {/* SECTION 1: Field Operations Status */}
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Field Operations Status</Text>
                  <Text style={styles.sectionSubtitle}>
                    Water supply network & consumable stock
                  </Text>
                </View>
              </View>

              <View style={styles.grid2x2}>
                {/* 1. Faulty Assets (highlighted when > 0) */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    (dashboard.assets?.faulty || 0) > 0 && styles.cardDangerHighlight,
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetList', {
                      initialStatus: 'FAULTY',
                      status: 'FAULTY',
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Faulty assets: ${dashboard.assets?.faulty || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.assets?.faulty || 0) > 0
                              ? tones.danger.bg
                              : tones.neutral.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="alert-circle"
                        size={22}
                        color={
                          (dashboard.assets?.faulty || 0) > 0
                            ? tones.danger.fg
                            : colors.muted
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardValue,
                      (dashboard.assets?.faulty || 0) > 0 && {
                        color: tones.danger.fg,
                      },
                    ]}
                  >
                    {dashboard.assets?.faulty ?? 0}
                  </Text>
                  <Text style={styles.cardLabel}>Faulty Assets</Text>
                  <Text
                    style={[
                      styles.cardSubText,
                      (dashboard.assets?.faulty || 0) > 0 && {
                        color: tones.danger.fg,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {(dashboard.assets?.faulty || 0) > 0
                      ? 'Requires inspection'
                      : 'All systems normal'}
                  </Text>
                </TouchableOpacity>

                {/* 2. Low-Stock Items (highlighted when > 0) */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    (dashboard.lowStockCount || 0) > 0 && styles.cardWarningHighlight,
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.inventory, 'InventoryList', {
                      lowStockOnly: true,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Low stock items: ${dashboard.lowStockCount || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.lowStockCount || 0) > 0
                              ? tones.warning.bg
                              : tones.neutral.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="file-tray-stacked-outline"
                        size={22}
                        color={
                          (dashboard.lowStockCount || 0) > 0
                            ? tones.warning.fg
                            : colors.muted
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardValue,
                      (dashboard.lowStockCount || 0) > 0 && {
                        color: tones.warning.fg,
                      },
                    ]}
                  >
                    {dashboard.lowStockCount ?? 0}
                  </Text>
                  <Text style={styles.cardLabel}>Low-Stock Items</Text>
                  <Text
                    style={[
                      styles.cardSubText,
                      (dashboard.lowStockCount || 0) > 0 && {
                        color: tones.warning.fg,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {(dashboard.lowStockCount || 0) > 0
                      ? 'Below reorder level'
                      : 'Adequate stock'}
                  </Text>
                </TouchableOpacity>

                {/* 3. Under Repair */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    (dashboard.assets?.underRepair || 0) > 0 && styles.cardWarningHighlight,
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetList', {
                      initialStatus: 'UNDER_REPAIR',
                      status: 'UNDER_REPAIR',
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Under repair: ${dashboard.assets?.underRepair || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        {
                          backgroundColor:
                            (dashboard.assets?.underRepair || 0) > 0
                              ? tones.warning.bg
                              : tones.neutral.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="construct-outline"
                        size={22}
                        color={
                          (dashboard.assets?.underRepair || 0) > 0
                            ? tones.warning.fg
                            : colors.muted
                        }
                      />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.cardValue,
                      (dashboard.assets?.underRepair || 0) > 0 && {
                        color: tones.warning.fg,
                      },
                    ]}
                  >
                    {dashboard.assets?.underRepair ?? 0}
                  </Text>
                  <Text style={styles.cardLabel}>Under Repair</Text>
                  <Text style={styles.cardSubText}>
                    {(dashboard.assets?.underRepair || 0) > 0
                      ? 'Ongoing repairs'
                      : 'No active repairs'}
                  </Text>
                </TouchableOpacity>

                {/* 4. Total Assets */}
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetList')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Total assets: ${dashboard.assets?.total || 0}`}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIconBox, { backgroundColor: tones.info.bg }]}>
                      <Ionicons name="cube-outline" size={22} color={tones.info.fg} />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                  <Text style={styles.cardValue}>{dashboard.assets?.total ?? 0}</Text>
                  <Text style={styles.cardLabel}>Total Assets</Text>
                  <Text style={styles.cardSubText}>Borewells & tanks</Text>
                </TouchableOpacity>
              </View>

              {/* SECTION 2: Worker Quick Actions */}
              <View style={[styles.sectionHeaderRow, { marginTop: spacing.xl }]}>
                <View>
                  <Text style={styles.sectionTitle}>Field Quick Actions</Text>
                  <Text style={styles.sectionSubtitle}>
                    Tasks and maintenance operations
                  </Text>
                </View>
              </View>

              <View style={styles.quickActionsList}>
                {/* Action 1: Add Asset */}
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetForm')
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Add new asset"
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      { backgroundColor: tones.info.bg },
                    ]}
                  >
                    <Ionicons name="add-circle" size={24} color={tones.info.fg} />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>Add Asset</Text>
                    <Text style={styles.actionSubtitle}>
                      Register newly installed tap post, valve, or pump
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>

                {/* Action 2: Add Note / Report Fault */}
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigateTo(strings.assets, 'AssetList')
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Add note or report fault"
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      { backgroundColor: tones.warning.bg },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={24}
                      color={tones.warning.fg}
                    />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>Add Note / Report Fault</Text>
                    <Text style={styles.actionSubtitle}>
                      Select asset from list to log inspection note or issue
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>

                {/* Action 3: Use Stock */}
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigateTo(strings.inventory, 'InventoryList')
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Use stock consumables"
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      { backgroundColor: tones.success.bg },
                    ]}
                  >
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={24}
                      color={tones.success.fg}
                    />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>Use Stock</Text>
                    <Text style={styles.actionSubtitle}>
                      Record consumption of joints, seals, or bleaching powder
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          )
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Re-export DashboardScreen alias
export { HomeScreen as DashboardScreen };

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  gpInfoContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  gpBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  gpLocationText: {
    fontSize: 12,
    color: colors.muted,
    marginLeft: 18,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  logoutIconButton: {
    backgroundColor: '#FDECEA',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  userNameContainer: {
    flex: 1,
  },
  greetingSub: {
    fontSize: 12,
    color: colors.muted,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#F8B4B4',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  errorMessage: {
    fontSize: 12,
    color: tones.danger.fg,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tones.danger.fg,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: tones.danger.fg,
  },
  viewSection: {
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDangerHighlight: {
    borderColor: '#F8B4B4',
    backgroundColor: '#FFFDFD',
  },
  cardWarningHighlight: {
    borderColor: '#FDE0B2',
    backgroundColor: '#FFFEFA',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardCurrencyValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  cardSubText: {
    fontSize: 11,
    color: colors.muted,
  },
  quickActionsList: {
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
