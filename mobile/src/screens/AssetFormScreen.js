// TODO: Replace this temporary stub with the real asset form screen in a later step.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { strings } from '../strings';
import { colors, spacing } from '../theme';

export default function AssetFormScreen({ route }) {
  const paramsText = route?.params ? JSON.stringify(route.params) : '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.comingSoon}</Text>
      {paramsText ? <Text style={styles.params}>{paramsText}</Text> : null}
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
