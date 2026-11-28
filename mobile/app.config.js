module.exports = ({ config } = {}) => {
  const baseConfig = config || {};
  const googleMapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();

  // Validate at build/export time so we never silently ship a blank map APK
  if (!googleMapsApiKey || googleMapsApiKey.startsWith('AIzaSyDummyKey')) {
    console.warn(
      '\n⚠️  [JalSetu Build Warning]: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is unset or using a dummy placeholder.' +
      '\n   Standalone Android APK Google Maps tiles may render blank without a valid production API key.\n'
    );
  }

  return {
    ...baseConfig,
    android: {
      ...baseConfig.android,
      config: {
        ...baseConfig.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
    },
  };
};
