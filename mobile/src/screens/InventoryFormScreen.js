/**
 * InventoryFormScreen.js
 * Form screen for creating or editing an inventory item.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { strings } from '../strings';

export default function InventoryFormScreen({ route }) {
  const isEdit = route.params?.mode === 'edit';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isEdit ? 'Edit Inventory Item' : strings.addItemTitle}
      </Text>
      <Text style={styles.info}>Inventory item form fields will load here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  info: {
    fontSize: 15,
    color: colors.text,
  },
});
