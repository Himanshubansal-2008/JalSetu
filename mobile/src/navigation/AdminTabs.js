import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import AssetsStack from './AssetsStack';
import InventoryStack from './InventoryStack';
import FinanceStack from './FinanceStack';
import ConsumersStack from './ConsumersStack';
import { useAuthStore } from '../store/authStore';
import { strings } from '../strings';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function AdminTabs() {
  const user = useAuthStore((state) => state.user);
  const role = (user?.role || '').toLowerCase();
  const isMainAdmin = role === 'main_admin' || Boolean(user?.isMainAdmin);
  const isAdmin =
    role === 'admin' ||
    isMainAdmin ||
    user?.role?.toUpperCase() === 'ADMIN';

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
          if (route.name === strings.dashboard || route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === strings.assets) {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === strings.inventory) {
            iconName = focused ? 'file-tray-stacked' : 'file-tray-stacked-outline';
          } else if (route.name === strings.finance) {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === strings.consumers) {
            iconName = focused ? 'people' : 'people-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name={strings.dashboard}
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
      {isAdmin && (
        <Tab.Screen
          name={strings.finance}
          component={FinanceStack}
          options={{ headerShown: false, tabBarLabel: 'Finance' }}
        />
      )}
      {isAdmin && (
        <Tab.Screen
          name={strings.consumers}
          component={ConsumersStack}
          options={{ headerShown: false, tabBarLabel: 'Consumers' }}
        />
      )}
    </Tab.Navigator>
  );
}
