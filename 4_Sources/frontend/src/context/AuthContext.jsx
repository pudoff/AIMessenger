import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MOCK_USERS } from '../data/users';

const STORAGE_KEY = 'slon_auth';

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(loadStoredUser);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentUser]);

  const login = ({ login, password }) => {
    const identifier = login.toLowerCase().trim();

    const account = MOCK_USERS.find(
      (user) =>
        (user.login.toLowerCase() === identifier || 
        (user.email && user.email.toLowerCase() === identifier)) && 
        user.password === password
    );

    if (!account) {
      return {
        success: false,
        message: 'Неверный логин или пароль'
      };
    }

    const sessionUser = {
      login: account.login,
      role: account.role,
      name: account.name,
      position: account.position,
      email: account.email
    };

    setCurrentUser(sessionUser);

    return {
      success: true,
      user: sessionUser
    };
  };

  const logout = () => setCurrentUser(null);

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      login,
      logout
    }),
    [currentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }

  return context;
}
