/**
 * ConsumersStack.js
 * Navigation stack for the Consumers module: Consumers list, Add/Edit Consumer,
 * Consumer Detail, and Monthly Bills.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ConsumersScreen from '../screens/ConsumersScreen';
import ConsumerFormScreen from '../screens/ConsumerFormScreen';
import ConsumerDetailScreen from '../screens/ConsumerDetailScreen';
import BillsScreen from '../screens/BillsScreen';
import { strings } from '../strings';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function ConsumersStack() {
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
        name="ConsumersList"
        component={ConsumersScreen}
        options={{
          title: strings.consumersTitle || 'Consumers',
        }}
      />
      <Stack.Screen
        name="ConsumerForm"
        component={ConsumerFormScreen}
        options={({ route }) => ({
          title: route.params?.consumer
            ? strings.editConsumer
            : strings.addConsumer,
        })}
      />
      <Stack.Screen
        name="ConsumerDetail"
        component={ConsumerDetailScreen}
        options={({ route }) => ({
          title: route.params?.consumer?.name || 'Consumer Details',
        })}
      />
      <Stack.Screen
        name="BillsList"
        component={BillsScreen}
        options={{
          title: strings.monthlyBills || 'Monthly Bills',
        }}
      />
    </Stack.Navigator>
  );
}
