import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import { setupReauthInterceptor } from './reauth';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const user = useAuthStore.getState().user;
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (user) {
    config.headers['X-User-Id'] = user.id;
    config.headers['X-User-Role'] = user.activeRole;
  }
  return config;
});

setupReauthInterceptor(apiClient);
