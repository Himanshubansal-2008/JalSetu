/**
 * InventoryDetailScreen.js
 * Screen displaying details and stock history for a single inventory item.
 * Includes header Edit trigger for admin users.
 */

import React, { useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors, spacing } from '../theme';
import { strings } from '../strings';

export default function InventoryDetailScreen({ route, navigation }) {
  const item = route.params?.item;
  const itemId = route.params?.itemId || route.params?.id || item?.id;
  const name = route.params?.name || item?.name || strings.inventoryDetailTitle;

  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.role?.toUpperCase() === 'ADMIN';

  // Expose Edit trigger in header for admins
  useLayoutEffect(() => {
    navigation.setOptions({
      title: name,
      headerRight: isAdmin
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('InventoryForm', {
                  itemId,
                  id: itemId,
                  item,
                  mode: 'edit',
                })
              }
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={strings.edit}
            >
              <Text style={styles.headerButtonText}>{strings.edit}</Text>
            </TouchableOpacity>
          )
        : null,
    });
  }, [navigation, isAdmin, itemId, item, name]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>ID: {itemId}</Text>
      <Text style={styles.info}>
        Detail view and stock transactions will load here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  headerButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  info: {
    fontSize: 15,
    color: colors.text,
  },
});
