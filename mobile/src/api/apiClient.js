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

// Helper to extract clean, friendly human-readable error messages (never raw Axios or HTML dumps)
export function getErrorMessage(error, fallbackMessage) {
  if (!error) return fallbackMessage || strings.genericError;

  // 1. Structured backend error
  const serverError =
    error.response?.data?.error ||
    error.response?.data?.message ||
    (typeof error.response?.data === 'string' && !error.response.data.includes('<html')
      ? error.response.data
      : null);

  if (serverError && typeof serverError === 'string') {
    return serverError;
  }

  // 2. Network timeouts or offline errors mapped to friendly server reachability message
  const isNetwork =
    error.message === 'Network Error' ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    error.message?.includes('timeout') ||
    error.message?.includes('Network request failed');

  if (isNetwork) {
    return 'Unable to reach JalSetu server. Check your internet connection and try again.';
  }

  // 3. HTTP 500+ Internal Server Error (filter out raw status string)
  if (error.response?.status >= 500) {
    return fallbackMessage || 'Server encountered an internal error. Please try again later.';
  }

  // 4. Clean error message (excluding raw Axios status codes)
  if (error.message && typeof error.message === 'string') {
    if (error.message.startsWith('Request failed with status code')) {
      return fallbackMessage || strings.genericError;
    }
    return error.message;
  }

  return fallbackMessage || strings.genericError;
}

export default apiClient;
