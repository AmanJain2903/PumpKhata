import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthUser {
  user_id: number;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('pumpkhata_token'));
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        setUser(JSON.parse(jsonPayload));
      } catch (e) {
        console.error("Invalid token format");
        logout();
      }
    } else {
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    const handleAuthError = () => logout();
    window.addEventListener('auth_error', handleAuthError);
    return () => window.removeEventListener('auth_error', handleAuthError);
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('pumpkhata_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('pumpkhata_token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
