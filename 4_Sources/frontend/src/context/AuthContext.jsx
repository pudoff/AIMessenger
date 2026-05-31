// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI } from '../api/auth';

const AuthContext = createContext(null);

// Загружаем токен при старте
function loadStoredToken() {
  return localStorage.getItem('auth_token');
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(loadStoredToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // При наличии токена — загружаем профиль пользователя
  useEffect(() => {
    let mounted = true;
    
    const fetchProfile = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        const user = await authAPI.getMe();
        if (mounted) setCurrentUser(user);
      } catch (err) {
        // Токен протух или невалиден — чистим
        localStorage.removeItem('auth_token');
        setToken(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchProfile();
    return () => { mounted = false; };
  }, [token]);

  const login = async (username, password) => {
    setError(null);
    setLoading(true);
    try {
      const { token: newToken } = await authAPI.login(username, password);
      localStorage.setItem('auth_token', newToken);
      const user = await authAPI.getMe();
      setToken(newToken);
      setCurrentUser(user);
      return { success: true, user };
    } catch (err) {
      localStorage.removeItem('auth_token');
      setToken(null);
      setCurrentUser(null);
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setError(null);
    setLoading(true);
    try {
      const data = await authAPI.register(userData);
      // Ждем подтверждения email, поэтому не авторизуем пользователя сразу.
      localStorage.removeItem('auth_token');
      setToken(null);
      setCurrentUser(null);
      return { success: true, data };
    } catch (err) {
      setError(null);
      return { success: false, message: err.message, errors: err.data };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authAPI.logout();
    setToken(null);
    setCurrentUser(null);
  };

  const refreshProfile = async () => {
    const user = await authAPI.getMe();
    setCurrentUser(user);
    return user;
  };

  const value = useMemo(() => ({
    currentUser,
    isAuthenticated: !!currentUser,
    loading,
    error,
    login,
    register,
    logout,
    refreshProfile,
    clearError: () => setError(null)
  }), [currentUser, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}
