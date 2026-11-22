import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken, getAuthToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.getCurrentUser();
        setUser(data.user);
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setAuthToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email, password, allowedRoles = null) => {
    const data = await api.login(email, password);

    // Validate the selected sign-in path before publishing the user to app state.
    // This prevents the wrong portal from rendering even briefly.
    if (allowedRoles && !allowedRoles.includes(data.user.role)) {
      const error = new Error('This account does not have access to this sign-in option.');
      error.code = 'ROLE_MISMATCH';
      throw error;
    }

    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const data = await api.register(name, email, password);
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  };

  const switchUser = async (email, password = 'Password123!') => {
    return await login(email, password);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    switchUser,
    isAdmin: user?.role === 'ADMIN',
    isAgent: user?.role === 'AGENT',
    isStaff: user?.role === 'ADMIN' || user?.role === 'AGENT',
    isCustomer: user?.role === 'CUSTOMER',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
