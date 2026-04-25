import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireRole({ role, children }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  if (currentUser.role !== role) {
    return (
      <Navigate
        to={currentUser.role === 'admin' ? '/admin' : '/app'}
        replace
      />
    );
  }

  return children;
}

export function RequireGuest({ children }) {
  const { currentUser } = useAuth();

  if (currentUser) {
    return (
      <Navigate
        to={currentUser.role === 'admin' ? '/admin' : '/app'}
        replace
      />
    );
  }

  return children;
}
