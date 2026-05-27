import { NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

// Импортируем иконки из assets
import chatIcon from '../assets/icons_final/01_chat.png';
import directIcon from '../assets/icons_final/09_users.png';
import groupsIcon from '../assets/icons_final/09_users.png';
import communitiesIcon from '../assets/icons_final/03_network.png';
import contactsIcon from '../assets/icons_final/08_contacts.png';
import assistantIcon from '../assets/icons_final/04_assistant.png';
import settingsIcon from '../assets/icons_final/06_settings.png';

const items = [
  { to: '/app', label: 'Чаты', icon: chatIcon },
  { to: '/app/direct', label: 'Личные сообщения', icon: directIcon },
  { to: '/app/groups', label: 'Корпоративные чаты', icon: groupsIcon },
  { to: '/app/communities', label: 'Сообщества', icon: communitiesIcon },
  { to: '/app/contacts', label: 'Контакты', icon: contactsIcon },
  { to: '/app/assistant', label: 'AI-ассистент', icon: assistantIcon },
  { label: 'Настройки', icon: settingsIcon, disabled: true }
];

function SidebarNav() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const fullName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() 
                 || currentUser?.username || 'Пользователь';
  
  const initials = (fullName.slice(0, 2) || '??').toUpperCase();

  const roleLabels = { user: 'Сотрудник', admin: 'Администратор' };
  const displayRole = roleLabels[currentUser?.role] || '';

  return (
    <aside className="shell-sidebar">
      <Logo compact />

      <button
        className="primary-button shell-sidebar__new-chat"
        type="button"
        onClick={() => navigate('/app/contacts')}
        title="Найти контакт и начать личный чат"
      >
        Новый чат
      </button>

      <nav className="shell-nav">
        {items.map((item) =>
          item.disabled ? (
            <div key={item.label} className="shell-nav__item">
              <span className="shell-nav__icon" aria-hidden="true">
                <img src={item.icon} alt={item.label} style={{ width: '100%', height: 'auto' }} />
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
                <img src={item.icon} alt={item.label} style={{ width: '100%', height: 'auto' }} />
              </span>
              <span>{item.label}</span>
            </NavLink>
          )
        )}
      </nav>

      <div className="profile-card">
        <div className="avatar avatar--primary">
          {initials}
        </div>
        <div className="profile-card__text">
          <strong>{fullName}</strong>
          {/* <span>{displayRole}</span> */}
        </div>
      </div>

      <button className="secondary-button" type="button" onClick={logout}>
        Выйти
      </button>
    </aside>
  );
}

export default SidebarNav;
