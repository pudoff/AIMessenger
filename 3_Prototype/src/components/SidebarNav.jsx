import { NavLink } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

const items = [
  { to: '/app', label: 'Чаты', icon: '💬' },
  { to: '/app/direct', label: 'Личные сообщения', icon: '👤' },
  { to: '/app/groups', label: 'Корпоративные чаты', icon: '🏢' },
  { to: '/app/communities', label: 'Сообщества', icon: '🌐' },
  { to: '/app/contacts', label: 'Контакты', icon: '📇' },
  { to: '/app/assistant', label: 'AI-ассистент', icon: '✦' },
  { label: 'Настройки', icon: '⚙️', disabled: true }
];

function SidebarNav() {
  const { currentUser, logout } = useAuth();

  return (
    <aside className="shell-sidebar">
      <Logo compact />

      <button className="primary-button shell-sidebar__new-chat" type="button">
        Новый чат
      </button>

      <nav className="shell-nav">
        {items.map((item) => (
          item.disabled ? (
            <div key={item.label} className="shell-nav__item">
              <span className="shell-nav__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
          ) : (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) =>
                `shell-nav__item ${isActive ? 'shell-nav__item--active' : ''}`
              }
            >
              <span className="shell-nav__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          )
        ))}
      </nav>

      <div className="profile-card">
        <div className="avatar avatar--primary">
          {currentUser?.name?.slice(0, 2).toUpperCase()}
        </div>
        <div className="profile-card__text">
          <strong>{currentUser?.name}</strong>
          <span>{currentUser?.position}</span>
        </div>
      </div>

      <button className="secondary-button" type="button" onClick={logout}>
        Выйти
      </button>
    </aside>
  );
}

export default SidebarNav;
