import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';
import { strings } from '../strings';

// Create configured Axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

// Interceptor to attach JWT Bearer token if present in SecureStore
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // If SecureStore retrieval fails, proceed with the unauthenticated request
  }
  return config;
});

// Helper to extract human-readable error messages
export function getErrorMessage(error) {
  if (error.response && error.response.data && error.response.data.error) {
    return error.response.data.error;
  }
  return strings.networkError;
}

export default apiClient;
