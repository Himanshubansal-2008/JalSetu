import Constants from 'expo-constants';

// Note: When running on a physical mobile device or emulator, "localhost"
// refers to the device itself, not the computer hosting the Express API.
// We therefore dynamically extract the host LAN IP from the Expo development server,
// or fallback to the production Render URL.

function getBaseUrl() {
  // 1. Explicit environment variable override (e.g. set in .env or EAS build env)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Development mode: extract host LAN IP from Expo dev server if available
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host) {
        return `http://${host}:4000/api`;
      }
    }
  }

  // 3. Production Render URL fallback for standalone builds and production deployments
  return 'https://jalsetu.onrender.com/api';
}

export const API_URL = getBaseUrl();
