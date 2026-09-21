// ============================================================================
// Auth Hook & Context
// ============================================================================

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import { authService } from '../services/auth';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isMockMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestOtp: (email: string, displayName: string) => Promise<void>;
  register: (email: string, otp: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'ecoroute_access_token';
const REFRESH_KEY = 'ecoroute_refresh_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMockMode, setIsMockMode] = useState(false);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    api.setToken(null);
    setUser(null);
  }, []);

  const setAuthFromTokens = useCallback((accessToken: string, refreshToken: string, userData: User) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    api.setToken(accessToken);
    setUser(userData);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login(email, password);
    const { user: u, accessToken, refreshToken } = response.data;
    setAuthFromTokens(accessToken, refreshToken, u);
  }, [setAuthFromTokens]);

  const requestOtp = useCallback(async (email: string, displayName: string) => {
    await authService.requestOtp(email, displayName);
  }, []);

  const register = useCallback(async (email: string, otp: string, password: string, displayName: string) => {
    const response = await authService.register(email, otp, password, displayName);
    const { user: u, accessToken, refreshToken } = response.data;
    setAuthFromTokens(accessToken, refreshToken, u);
  }, [setAuthFromTokens]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const refreshAuth = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      clearAuth();
      return;
    }
    try {
      const response = await authService.refresh(refreshToken);
      const { accessToken, refreshToken: newRefresh } = response.data;
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, newRefresh);
      api.setToken(accessToken);
    } catch {
      clearAuth();
    }
  }, [clearAuth]);

  // Initialize auth state from stored tokens
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      api.setToken(token);
      try {
        const response = await authService.getProfile();
        setUser(response.data);
      } catch {
        // Try refresh
        try {
          await refreshAuth();
          const response = await authService.getProfile();
          setUser(response.data);
        } catch {
          clearAuth();
          setIsMockMode(true);
        }
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, [clearAuth, refreshAuth]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      isMockMode,
      login,
      requestOtp,
      register,
      logout,
      refreshAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
