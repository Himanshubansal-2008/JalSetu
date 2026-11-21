import Constants from 'expo-constants';

// Note: When running on a physical mobile device or emulator, "localhost"
// refers to the device itself, not the computer hosting the Express API.
// We therefore dynamically extract the host LAN IP from the Expo development server.

function getBaseUrl() {
  // 1. Manual environment variable override
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Development mode: extract host LAN IP from Expo dev server
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host) {
        return `http://${host}:4000/api`;
      }
    }
    throw new Error(
      'Unable to determine development server host IP from Constants.expoConfig.hostUri. Please ensure the Expo dev server is running or set EXPO_PUBLIC_API_URL.'
    );
  }

  // 3. Production placeholder (TODO: Production backend must use HTTPS; replace with Render URL when deployed)
  return 'https://REPLACE_WITH_RENDER_URL/api';
}

export const API_URL = getBaseUrl();
