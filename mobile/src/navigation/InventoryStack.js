/**
 * InventoryStack.js
 * Navigation stack for Inventory: list, form, and detail screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InventoryListScreen from '../screens/InventoryListScreen';
import InventoryDetailScreen from '../screens/InventoryDetailScreen';
import InventoryFormScreen from '../screens/InventoryFormScreen';
import { strings } from '../strings';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function InventoryStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.white,
        },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="InventoryList"
        component={InventoryListScreen}
        options={{
          title: strings.inventoryTitle,
        }}
      />
      <Stack.Screen
        name="InventoryDetail"
        component={InventoryDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || strings.inventoryDetailTitle,
        })}
      />
      <Stack.Screen
        name="InventoryForm"
        component={InventoryFormScreen}
        options={({ route }) => ({
          title:
            route.params?.mode === 'edit'
              ? 'Edit Item'
              : strings.addItemTitle,
        })}
      />
    </Stack.Navigator>
  );
}
