import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CurrentUser, UserRole, RegisterFormData, AuthResponse, ClassCourse} from '../types';

export interface AuthContextType {
  user: CurrentUser | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role?: string) => Promise<{ success: boolean; error?: string; user?: CurrentUser; token?: string }>;
  register: (data: RegisterFormData) => Promise<{ success: boolean; error?: string; user?: CurrentUser; token?: string }>;
  setSession: (user: CurrentUser, token: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AUTH_TOKEN_KEY = 'simlab_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Derive role safely from authenticated backend user identity only
  const role: UserRole | null = user?.role
    ? ((user.role as string).toLowerCase() as UserRole)
    : null;

  const isAuthenticated = !!user && !!token;

  // Restore authenticated session from backend source-of-truth on initial load
  const refreshUser = useCallback(async () => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          // Normalize role consistently (e.g. STUDENT -> student)
          const normalizedUser: CurrentUser = {
            ...data.user,
            role: (data.user.role || 'student').toLowerCase() as UserRole,
          };
          setUser(normalizedUser);
          setToken(savedToken);
        } else {
          // Invalidate stale or revoked token
          if (typeof window !== 'undefined') {
            localStorage.removeItem(AUTH_TOKEN_KEY);
          }
          setUser(null);
          setToken(null);
        }
      } else {
        // 401 or 403 response
        if (typeof window !== 'undefined') {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        setUser(null);
        setToken(null);
      }
    } catch {
      // Network error: clear unverified user to prevent unauthorized access
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const setSession = useCallback((newUser: CurrentUser, newToken: string) => {
    const normalizedUser: CurrentUser = {
      ...newUser,
      role: (newUser.role || 'student').toLowerCase() as UserRole,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    }
    setToken(newToken);
    setUser(normalizedUser);
  }, []);

  const login = async (email: string, password: string, roleParam?: string) => {
    try {
      const payload: Record<string, any> = { email: email.trim(), password };
      if (roleParam) {
        payload.role = roleParam.toLowerCase();
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: AuthResponse = await res.json();
      if (!res.ok || !data.success || !data.user || !data.token) {
        return {
          success: false,
          error: data.error || data.message || 'Authentication failed. Please verify your credentials.',
        };
      }

      const normalizedUser: CurrentUser = {
        ...data.user,
        role: (data.user.role || 'student').toLowerCase() as UserRole,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }
      setToken(data.token);
      setUser(normalizedUser);

      return { success: true, user: normalizedUser, token: data.token };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error occurred while authenticating.',
      };
    }
  };

  const register = async (formData: RegisterFormData) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          name: formData.name.trim(),
          role: (formData.role || 'student').toLowerCase(),
          institution: formData.institution?.trim() || undefined,
          enrollmentCode: formData.enrollmentCode?.trim() || undefined,
        }),
      });

      const data: AuthResponse = await res.json();
      if (!res.ok || !data.success || !data.user || !data.token) {
        return {
          success: false,
          error: data.error || data.message || 'Registration failed. Please try again.',
        };
      }

      const normalizedUser: CurrentUser = {
        ...data.user,
        role: (data.user.role || 'student').toLowerCase() as UserRole,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }
      setToken(data.token);
      setUser(normalizedUser);

      return { success: true, user: normalizedUser, token: data.token };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error occurred during registration.',
      };
    }
  };

  const logout = async () => {
    const currentToken = token || (typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ token: currentToken }),
        });
      } catch {
        // Silently continue client-side cleanup
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        setSession,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
