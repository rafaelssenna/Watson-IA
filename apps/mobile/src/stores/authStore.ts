import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { api } from "@/services/api";
import { tokenManager } from "@/services/tokenManager";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  phone?: string;
}

// Secure storage adapter for sensitive data
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      initialize: async () => {
        // Wait a bit for persist hydration
        await new Promise((resolve) => setTimeout(resolve, 100));

        const accessToken = get().accessToken;
        const refreshToken = get().refreshToken;

        console.log("Auth init - tokens:", { hasAccess: !!accessToken, hasRefresh: !!refreshToken });

        if (!accessToken || !refreshToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          // Try to get current user with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await api.get<{ success: boolean; data: User }>("/auth/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.data.success) {
            set({
              user: response.data.data,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isLoading: false, isAuthenticated: false });
          }
        } catch (error) {
          console.log("Auth init error:", error);
          // Token might be expired or network error, just go to login
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          const response = await api.post<{
            success: boolean;
            data: { user: User; accessToken: string; refreshToken: string };
          }>("/auth/login", { email, password });

          if (response.data.success) {
            const { user, accessToken, refreshToken } = response.data.data;

            set({
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(
            error.response?.data?.error?.message || error.message || "Erro ao fazer login"
          );
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true });

        try {
          const response = await api.post<{
            success: boolean;
            data: { user: User; accessToken: string; refreshToken: string };
          }>("/auth/register", data);

          if (response.data.success) {
            const { user, accessToken, refreshToken } = response.data.data;

            set({
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(
            error.response?.data?.error?.message || error.message || "Erro ao criar conta"
          );
        }
      },

      logout: async () => {
        const { refreshToken } = get();

        try {
          await api.post("/auth/logout", { refreshToken });
        } catch {
          // Ignore errors on logout
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const response = await api.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string };
        }>("/auth/refresh", { refreshToken });

        if (response.data.success) {
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            response.data.data;

          set({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          });

          // Fetch user data with new token
          const userResponse = await api.get<{ success: boolean; data: User }>("/auth/me", {
            headers: { Authorization: `Bearer ${newAccessToken}` },
          });

          if (userResponse.data.success) {
            set({
              user: userResponse.data.data,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        }
      },
    }),
    {
      name: "watson-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize token manager with auth store functions
tokenManager.setGetAccessToken(() => useAuthStore.getState().accessToken);
tokenManager.setRefreshToken(() => useAuthStore.getState().refreshAccessToken());
tokenManager.setLogout(() => useAuthStore.getState().logout());
