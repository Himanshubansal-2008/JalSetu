import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import AssetsStack from './AssetsStack';
import InventoryStack from './InventoryStack';
import ProfileScreen from '../screens/ProfileScreen';
import { strings } from '../strings';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function WorkerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: true,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'ellipse-outline';
          if (route.name === strings.home || route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === strings.assets || route.name === 'Assets') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === strings.inventory || route.name === 'Inventory') {
            iconName = focused ? 'file-tray-stacked' : 'file-tray-stacked-outline';
          } else if (route.name === 'Profile' || route.name === strings.profile) {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name={strings.home}
        component={HomeScreen}
        options={{ headerShown: false, tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name={strings.assets}
        component={AssetsStack}
        options={{ headerShown: false, tabBarLabel: 'Assets' }}
      />
      <Tab.Screen
        name={strings.inventory}
        component={InventoryStack}
        options={{ headerShown: false, tabBarLabel: 'Inventory' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false, tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
