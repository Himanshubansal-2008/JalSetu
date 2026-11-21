import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { strings } from '../strings';
import { colors } from '../theme';

export default function PlaceholderScreen({ route }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.screenName}>{route.name}</Text>
      <Text style={styles.comingSoon}>{strings.comingSoon}</Text>

      {user ? (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>
            {strings.loggedInAs} {user.name}
          </Text>
          <Text style={styles.roleText}>
            {strings.role} {user.role}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>{strings.logout}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  screenName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  comingSoon: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: 24,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userText: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    color: colors.muted,
  },
  logoutButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
});
