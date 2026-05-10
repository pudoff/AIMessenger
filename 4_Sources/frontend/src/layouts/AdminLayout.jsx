import { Outlet } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

function AdminLayout() {
  const { logout, currentUser } = useAuth();
  const fullName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim()
    || currentUser?.username
    || 'Администратор';
  const initials = (fullName.slice(0, 2) || '??').toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar">
        <Logo compact />
        <div className="admin-menu">
          <div className="admin-menu__item admin-menu__item--active">Панель администратора</div>
          <div className="admin-menu__item">Управление пользователями</div>
          <div className="admin-menu__item">Корпоративные чаты</div>
          <div className="admin-menu__item">Системные события</div>
        </div>
        <div className="profile-card">
          <div className="avatar avatar--primary">{initials}</div>
          <div className="profile-card__text">
            <strong>{fullName}</strong>
            <span>Администратор</span>
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Выйти
        </button>
      </aside>
      <main className="admin-shell__content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
