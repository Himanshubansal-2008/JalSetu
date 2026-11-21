import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/apiClient';

export const useAuthStore = create((set) => ({
  user: null,
  gp: null,
  loading: true,

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
      set({ user: response.data.user, gp: response.data.gp, loading: false });
    } catch (err) {
      // If unauthorized (401), the stored token is invalid or expired
      if (err.response && err.response.status === 401) {
        await SecureStore.deleteItemAsync('token').catch(() => {});
        set({ user: null, gp: null, loading: false });
      } else {
        // For network errors or timeouts, do NOT delete the stored token
        set({ loading: false });
      }
    }
  },

  // Log in user and persist JWT token
  login: async (phone, password) => {
    const response = await apiClient.post('/auth/login', { phone, password });
    const { token, user } = response.data;
    if (token) {
      await SecureStore.setItemAsync('token', token);
    }
    set({ user, loading: false });
    return response.data;
  },

  // Sign up new admin and Gram Panchayat, and persist JWT token
  signup: async (form) => {
    const response = await apiClient.post('/auth/signup', form);
    const { token, user } = response.data;
    if (token) {
      await SecureStore.setItemAsync('token', token);
    }
    set({ user, loading: false });
    return response.data;
  },

  // Log out user and remove JWT token
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('token');
    } catch (err) {
      // Ignore SecureStore delete errors
    }
    set({ user: null, gp: null, loading: false });
  },
}));
