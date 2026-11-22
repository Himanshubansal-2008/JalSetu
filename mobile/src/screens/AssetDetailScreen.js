// TODO: Replace this temporary stub with the real asset detail screen in a later step.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { strings } from '../strings';
import { colors, spacing, radius } from '../theme';

export default function AssetDetailScreen({ route, navigation }) {
  const id = route?.params?.id;
  const name = route?.params?.name;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.comingSoon}</Text>
      {id ? (
        <Text style={styles.params}>
          {id} {name ? `• ${name}` : ''}
        </Text>
      ) : null}

      {id ? (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('AssetForm', { id })}
          accessibilityRole="button"
          accessibilityLabel={strings.edit}
        >
          <Text style={styles.editButtonText}>{strings.edit}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  params: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  editButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.primary,
    borderRadius: radius.sm + 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
