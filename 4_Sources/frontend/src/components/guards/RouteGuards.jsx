import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Простой лоадер, чтобы не было белого экрана
const AuthLoader = () => (
  <div className="auth-loader">Загрузка...</div>
);

export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // 🔒 Ждём окончания проверки токена
  if (loading) return <AuthLoader />;
  
  // 🔒 Нет токена → редирект на логин
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export function RequireGuest({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // 🔒 Ждём окончания проверки
  if (loading) return <AuthLoader />;
  
  // 🔒 Уже авторизован → редирект в приложение
  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

export function RequireRole({ role, children }) {
  const { currentUser } = useAuth();

  // Этот гард всегда вложен в RequireAuth, поэтому currentUser гарантированно есть
  if (!currentUser) return null;
  
  if (currentUser.role !== role) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/app'} replace />;
  }

  return children;
}