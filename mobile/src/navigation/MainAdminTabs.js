/**
 * MainAdminTabs.js
 * Dedicated bottom tab navigator for Main Administrator (Super Admin).
 * Replaces GP-level tabs with state-wide executive command tabs:
 * - Overview: State platform metrics & water alerts
 * - Approvals: Incoming Gram Panchayat verification queue
 * - Panchayats: Directory of all Gram Panchayats with operational inspection
 * - Governance: Super Admin profile, audit logs & system controls
 */

import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import MainAdminOverviewScreen from '../screens/MainAdminOverviewScreen';
import MainAdminApprovalsScreen from '../screens/MainAdminApprovalsScreen';
import MainAdminPanchayatsScreen from '../screens/MainAdminPanchayatsScreen';
import MainAdminProfileScreen from '../screens/MainAdminProfileScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function MainAdminTabs() {
  const [pendingCount, setPendingCount] = useState(0);

  // Poll or fetch pending queue count on tab mount
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/gps/pending')
      .then((res) => {
        if (isMounted) {
          const list = res.data?.pendingGps || [];
          setPendingCount(list.length);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#B45309', // amber/gold for Main Admin
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'ellipse-outline';
          if (route.name === 'OverviewTab') {
            iconName = focused ? 'speedometer' : 'speedometer-outline';
          } else if (route.name === 'ApprovalsTab') {
            iconName = focused ? 'checkbox' : 'checkbox-outline';
          } else if (route.name === 'PanchayatsTab') {
            iconName = focused ? 'business' : 'business-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'shield' : 'shield-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="OverviewTab"
        component={MainAdminOverviewScreen}
        options={{
          tabBarLabel: 'Overview',
        }}
      />
      <Tab.Screen
        name="ApprovalsTab"
        component={MainAdminApprovalsScreen}
        options={{
          tabBarLabel: 'Approvals',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#B45309',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
          },
        }}
      />
      <Tab.Screen
        name="PanchayatsTab"
        component={MainAdminPanchayatsScreen}
        options={{
          tabBarLabel: 'Panchayats',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={MainAdminProfileScreen}
        options={{
          tabBarLabel: 'Governance',
        }}
      />
    </Tab.Navigator>
  );
}
