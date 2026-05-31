import { Outlet, NavLink } from 'react-router-dom';
import Avatar from '../components/Avatar';
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
        <nav className="admin-menu">
          <NavLink to="/admin" end className={({ isActive }) => `admin-menu__item${isActive ? ' admin-menu__item--active' : ''}`}>
            Дашборд
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `admin-menu__item${isActive ? ' admin-menu__item--active' : ''}`}>
            Пользователи
          </NavLink>
          <NavLink to="/admin/chats" className={({ isActive }) => `admin-menu__item${isActive ? ' admin-menu__item--active' : ''}`}>
            Корпоративные чаты
          </NavLink>
          <NavLink to="/admin/broadcast" className={({ isActive }) => `admin-menu__item${isActive ? ' admin-menu__item--active' : ''}`}>
            E-mail рассылка
          </NavLink>
        </nav>
        <div className="profile-card">
          <Avatar src={currentUser?.avatar_url} initials={initials} title={fullName} className="avatar--circle" />
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
