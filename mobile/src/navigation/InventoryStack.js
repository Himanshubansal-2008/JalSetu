/**
 * InventoryStack.js
 * Navigation stack for Inventory: list, form, and detail screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InventoryListScreen from '../screens/InventoryListScreen';
import InventoryDetailScreen from '../screens/InventoryDetailScreen';
import InventoryFormScreen from '../screens/InventoryFormScreen';
import StockInScreen from '../screens/StockInScreen';
import StockOutScreen from '../screens/StockOutScreen';
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
            route.params?.item ||
            route.params?.itemId ||
            route.params?.id ||
            route.params?.mode === 'edit'
              ? strings.editInventoryItem
              : strings.addInventoryItem,
        })}
      />
      <Stack.Screen
        name="StockIn"
        component={StockInScreen}
        options={({ route }) => ({
          title: route.params?.name
            ? `${strings.stockInTitle} · ${route.params.name}`
            : strings.stockInTitle,
        })}
      />
      <Stack.Screen
        name="StockOut"
        component={StockOutScreen}
        options={({ route }) => ({
          title: route.params?.name
            ? `${strings.stockOutTitle} · ${route.params.name}`
            : strings.stockOutTitle,
        })}
      />
    </Stack.Navigator>
  );
}
