/**
 * FinanceStack.js
 * Navigation stack for the Finance module: dashboard, entry forms, cash book, and monthly summary.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FinanceScreen from '../screens/FinanceScreen';
import FinanceEntryFormScreen from '../screens/FinanceEntryFormScreen';
import CashBookScreen from '../screens/CashBookScreen';
import MonthlySummaryScreen from '../screens/MonthlySummaryScreen';
import { strings } from '../strings';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function FinanceStack() {
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
        name="FinanceDashboard"
        component={FinanceScreen}
        options={{
          title: strings.financeTitle,
        }}
      />
      <Stack.Screen
        name="FinanceEntryForm"
        component={FinanceEntryFormScreen}
        options={({ route }) => ({
          title: route.params?.entry
            ? route.params.entry.type === 'RECEIPT'
              ? strings.editReceiptTitle
              : strings.editExpenseTitle
            : (route.params?.initialType || route.params?.mode) === 'EXPENSE'
            ? strings.addExpenseTitle
            : strings.addReceiptTitle,
        })}
      />
      <Stack.Screen
        name="CashBook"
        component={CashBookScreen}
        options={{
          title: strings.cashBook,
        }}
      />
      <Stack.Screen
        name="MonthlySummary"
        component={MonthlySummaryScreen}
        options={{
          title: strings.monthlySummary,
        }}
      />
    </Stack.Navigator>
  );
}
