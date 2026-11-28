import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import apiClient, { registerUnauthorizedHandler, reset401Lock } from '../api/apiClient';

export const useAuthStore = create((set, get) => ({
  user: null,
  gp: null,
  loading: true,
  sessionExpiredNotice: '',

  // Clear notice manually or on login
  clearSessionExpiredNotice: () => set({ sessionExpiredNotice: '' }),

  // Restore session from SecureStore on startup
  restore: async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        set({ user: null, gp: null, loading: false });
        return;
      }

      // Fetch current authenticated user and Gram Panchayat profile
      const response = await apiClient.get('/auth/me');
      reset401Lock();
      set({ user: response.data.user, gp: response.data.gp, loading: false });
    } catch (err) {
      // If unauthorized (401), the stored token is invalid or expired
      if (err.response && err.response.status === 401) {
        await SecureStore.deleteItemAsync('token').catch(() => {});
        set({
          user: null,
          gp: null,
          loading: false,
          sessionExpiredNotice: 'Session expired or account deactivated. Please log in again.',
        });
      } else {
        // For network errors or timeouts, do NOT delete the stored token
        set({ loading: false });
      }
    }
  },

  // Refresh current user and Gram Panchayat profile
  fetchProfile: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      set({ user: response.data.user, gp: response.data.gp });
      return response.data;
    } catch (err) {
      // Handled by 401 interceptor if unauthorized
      throw err;
    }
  },

  // Log in user and persist JWT token
  login: async (phone, password) => {
    const response = await apiClient.post('/auth/login', { phone, password });
    const { token, user } = response.data;
    if (token) {
      await SecureStore.setItemAsync('token', token);
    }
    reset401Lock();
    set({ user, sessionExpiredNotice: '', loading: false });

    // Also fetch fresh GP metadata if available
    try {
      const meRes = await apiClient.get('/auth/me');
      set({ user: meRes.data.user || user, gp: meRes.data.gp });
    } catch (_) {}

    return response.data;
  },

  // One-tap demo login (Admin or Worker) with optional dataset reset
  demoLogin: async ({ role, resetData = false }) => {
    const response = await apiClient.post('/auth/demo-login', { role, resetData });
    const { token, user, gp } = response.data;
    if (token) {
      await SecureStore.setItemAsync('token', token);
    }
    reset401Lock();
    set({ user, gp: gp || user?.gp || null, sessionExpiredNotice: '', loading: false });

    // Also fetch fresh GP metadata if available
    try {
      const meRes = await apiClient.get('/auth/me');
      set({ user: meRes.data.user || user, gp: meRes.data.gp || gp });
    } catch (_) {}

    return response.data;
  },

  // Sign up new admin and Gram Panchayat, and persist JWT token
  signup: async (form) => {
    const response = await apiClient.post('/auth/signup', form);
    const { token, user } = response.data;
    if (token) {
      await SecureStore.setItemAsync('token', token);
    }
    reset401Lock();
    set({ user, sessionExpiredNotice: '', loading: false });
    return response.data;
  },

  // Log out user and remove JWT token (supports { expired: boolean })
  logout: async (options = {}) => {
    const { expired = false } = options || {};
    try {
      await SecureStore.deleteItemAsync('token');
    } catch (err) {
      // Ignore SecureStore delete errors
    }
    set({
      user: null,
      gp: null,
      loading: false,
      sessionExpiredNotice: expired
        ? 'Session expired or account deactivated. Please log in again.'
        : '',
    });
  },
}));

// Register the centralized 401 unauthorized session expiry handler
registerUnauthorizedHandler(() => {
  useAuthStore.getState().logout({ expired: true });
});
