import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import AssetsStack from './AssetsStack';
import AssetMapScreen from '../screens/AssetMapScreen';
import InventoryStack from './InventoryStack';
import { strings } from '../strings';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: true,
        tabBarIcon: ({ color, size }) => {
          let iconName = 'ellipse-outline';
          if (route.name === strings.dashboard) {
            iconName = 'grid-outline';
          } else if (route.name === strings.assets) {
            iconName = 'cube-outline';
          } else if (route.name === strings.map) {
            iconName = 'map-outline';
          } else if (route.name === strings.inventory) {
            iconName = 'file-tray-stacked-outline';
          } else if (route.name === strings.finance) {
            iconName = 'cash-outline';
          } else if (route.name === strings.consumers) {
            iconName = 'people-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name={strings.dashboard} component={PlaceholderScreen} />
      <Tab.Screen
        name={strings.assets}
        component={AssetsStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name={strings.map}
        component={AssetMapScreen}
        options={{ title: strings.assetsMap }}
      />
      <Tab.Screen
        name={strings.inventory}
        component={InventoryStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen name={strings.finance} component={PlaceholderScreen} />
      <Tab.Screen name={strings.consumers} component={PlaceholderScreen} />
    </Tab.Navigator>
  );
}
