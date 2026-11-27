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

// Global 401 unauthorized handler state & idempotency lock
let unauthorizedHandler = null;
let isHandling401 = false;

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function reset401Lock() {
  isHandling401 = false;
}

// Interceptor to detect 401 Unauthorized on authenticated endpoints
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url || '';
    // Exclude /auth/login so invalid password / bad credentials still return inline
    const isLoginEndpoint = url.includes('/auth/login') || url.includes('/login');

    if (error.response && error.response.status === 401 && !isLoginEndpoint) {
      if (!isHandling401) {
        isHandling401 = true;
        if (typeof unauthorizedHandler === 'function') {
          unauthorizedHandler();
        }
      }
    }
    return Promise.reject(error);
  }
);

// Helper to extract human-readable error messages
export function getErrorMessage(error) {
  if (error.response && error.response.data && error.response.data.error) {
    return error.response.data.error;
  }
  return strings.networkError;
}

export default apiClient;
