// TODO: Replace this temporary stub with the real asset detail screen in a later step.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { strings } from '../strings';
import { colors, spacing } from '../theme';

export default function AssetDetailScreen({ route }) {
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
  },
});
