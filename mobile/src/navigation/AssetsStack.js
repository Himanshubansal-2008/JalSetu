/**
 * AssetsStack.js
 * Navigation stack for Assets: list, form, and detail screens.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AssetListScreen from '../screens/AssetListScreen';
import AssetFormScreen from '../screens/AssetFormScreen';
import AssetDetailScreen from '../screens/AssetDetailScreen';
import AssetMapScreen from '../screens/AssetMapScreen';
import { strings } from '../strings';
import { colors, spacing } from '../theme';

const Stack = createNativeStackNavigator();

export default function AssetsStack() {
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
        name="AssetList"
        component={AssetListScreen}
        options={({ navigation }) => ({
          title: strings.assetsTitle,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('AssetForm')}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={strings.addAsset}
            >
              <Text style={styles.headerButtonText}>{strings.add}</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="AssetForm"
        component={AssetFormScreen}
        options={{
          title: strings.assetFormTitle,
        }}
      />
      <Stack.Screen
        name="AssetDetail"
        component={AssetDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || strings.assetDetailTitle,
        })}
      />
      <Stack.Screen
        name="AssetMap"
        component={AssetMapScreen}
        options={{
          title: strings.assetsMap,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
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
});
