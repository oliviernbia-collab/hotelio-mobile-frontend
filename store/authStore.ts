import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '@/services/api';
import { User } from '@/types';

// SecureStore n'est pas disponible sur web — wrapper sécurisé
const storage = {
  async get(key: string): Promise<string | null> {
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    try { await SecureStore.setItemAsync(key, value); } catch {}
  },
  async remove(key: string): Promise<void> {
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },
};

interface AuthState {
  user:       User | null;
  token:      string | null;
  loading:    boolean;
  error:      string | null;
  serverDown: boolean;

  login:      (email: string, password: string) => Promise<void>;
  register:   (formData: FormData) => Promise<void>;
  logout:     () => Promise<void>;
  loadUser:   () => Promise<void>;
  setUser:    (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:       null,
  token:      null,
  loading:    false,
  error:      null,
  serverDown: false,

  setUser:    (user) => set({ user }),
  clearError: () => set({ error: null }),

  loadUser: async () => {
    set({ loading: true, serverDown: false });
    try {
      const token = await storage.get('auth_token');
      if (!token) { set({ loading: false }); return; }
      set({ token });
      const { data } = await authApi.me();
      set({ user: data, loading: false });
    } catch (err: any) {
      const isNetworkError = !err?.response && !!err?.request;
      if (isNetworkError) {
        // Serveur injoignable — ne pas effacer le token ni déconnecter l'utilisateur
        set({ loading: false, serverDown: true });
      } else {
        // Erreur d'auth (401) ou autre → déconnecter
        await storage.remove('auth_token');
        set({ user: null, token: null, loading: false });
      }
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authApi.login(email, password);
      await storage.set('auth_token', data.token);
      set({ user: data.user, token: data.token, loading: false });
    } catch (err: any) {
      let message: string;
      if (err.response) {
        message = err.response.data?.errors?.email?.[0]
          || err.response.data?.message
          || `Erreur serveur (${err.response.status})`;
      } else if (err.request) {
        message = `Serveur injoignable — vérifiez le Wi-Fi\n(${err.message})`;
      } else {
        message = err.message || 'Erreur inconnue';
      }
      set({ loading: false, error: message });
      throw err;
    }
  },

  register: async (formData) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authApi.register(formData);
      // prestataire en attente → pas de redirection auto
      if (data.status === 'en_attente') {
        set({ loading: false });
        return;
      }
      await storage.set('auth_token', data.token);
      set({ user: data.user, token: data.token, loading: false });
    } catch (err: any) {
      let message: string;
      if (err.response) {
        const errors = err.response.data?.errors;
        message = errors
          ? Object.values(errors).flat().join('\n')
          : err.response.data?.message || `Erreur serveur (${err.response.status})`;
      } else if (err.request) {
        message = `Serveur injoignable — vérifiez le Wi-Fi\n(${err.message})`;
      } else {
        message = err.message || 'Erreur inconnue';
      }
      set({ loading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    await storage.remove('auth_token');
    set({ user: null, token: null });
  },
}));
