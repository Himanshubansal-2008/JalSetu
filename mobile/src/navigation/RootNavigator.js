import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MainAdminTabs from './MainAdminTabs';
import AdminTabs from './AdminTabs';
import WorkerTabs from './WorkerTabs';
import ManageWorkersScreen from '../screens/ManageWorkersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const restore = useAuthStore((state) => state.restore);

  // Restore stored session once when RootNavigator mounts
  useEffect(() => {
    restore();
  }, []);

  // Show centered loading spinner while checking persisted token
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isMainAdmin = Boolean(
    user?.isMainAdmin ||
    user?.role === 'main_admin' ||
    user?.role === 'MAIN_ADMIN' ||
    user?.phone === '9992934154'
  );

  const isGpAdmin = Boolean(
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN'
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : isMainAdmin ? (
          <>
            <Stack.Screen name="MainAdminRoot" component={MainAdminTabs} />
          </>
        ) : isGpAdmin ? (
          <>
            <Stack.Screen name="AdminRoot" component={AdminTabs} />
            <Stack.Screen name="ManageWorkers" component={ManageWorkersScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="WorkerRoot" component={WorkerTabs} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
