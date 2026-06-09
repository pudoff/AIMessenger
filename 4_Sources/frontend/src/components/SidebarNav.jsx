import { NavLink, useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useUnread } from '../context/UnreadContext';

import chatIcon from '../assets/icons_final/01_chat.png';
import directIcon from '../assets/icons_final/09_users.png';
import groupsIcon from '../assets/icons_final/09_users.png';
import communitiesIcon from '../assets/icons_final/03_network.png';
import contactsIcon from '../assets/icons_final/08_contacts.png';
import assistantIcon from '../assets/icons_final/04_assistant.png';
import settingsIcon from '../assets/icons_final/06_settings.png';

const items = [
  { to: '/app', label: 'Чаты', icon: chatIcon, unreadKey: 'all' },
  { to: '/app/direct', label: 'Личные сообщения', icon: directIcon, unreadKey: 'direct' },
  { to: '/app/groups', label: 'Групповые чаты', icon: groupsIcon, unreadKey: 'groups' },
  { to: '/app/contacts', label: 'Контакты', icon: contactsIcon },
  { to: '/app/settings', label: 'Настройки', icon: settingsIcon },
];

function SidebarNav({ onNavigate }) {
  const { currentUser, logout } = useAuth();
  const { getSectionUnreadCount } = useUnread();
  const navigate = useNavigate();

  const fullName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim()
    || currentUser?.username
    || 'Пользователь';

  const initials = (fullName.slice(0, 2) || '??').toUpperCase();

  return (
    <aside className="shell-sidebar">
      <Logo compact />

      <button
        className="primary-button shell-sidebar__new-chat"
        type="button"
        onClick={() => {
          navigate('/app/contacts');
          onNavigate?.();
        }}
        title="Найти контакт и начать личный чат"
      >
        Новый чат
      </button>

      <nav className="shell-nav">
        {items.map((item) => {
          const unreadCount = item.unreadKey ? getSectionUnreadCount(item.unreadKey) : 0;
          const unreadIndicator = unreadCount > 0 && (
            <span
              className="shell-nav__unread-dot"
              aria-label={`Непрочитанных сообщений: ${unreadCount}`}
              title={`Непрочитанных сообщений: ${unreadCount}`}
            />
          );

          if (item.disabled) {
            return (
              <div key={item.label} className="shell-nav__item">
                <span className="shell-nav__icon" aria-hidden="true">
                  <img src={item.icon} alt="" />
                </span>
                <span>{item.label}</span>
                {unreadIndicator}
              </div>
            );
          }

          return (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) =>
                `shell-nav__item ${isActive ? 'shell-nav__item--active' : ''}`
              }
              onClick={onNavigate}
            >
              <span className="shell-nav__icon" aria-hidden="true">
                <img src={item.icon} alt="" />
              </span>
              <span>{item.label}</span>
              {unreadIndicator}
            </NavLink>
          );
        })}
      </nav>

      <div className="profile-card">
        <Avatar src={currentUser?.avatar_url} initials={initials} title={fullName} className="avatar--circle" />
        <div className="profile-card__text">
          <strong>{fullName}</strong>
        </div>
      </div>

      <button
        className="secondary-button"
        type="button"
        onClick={() => {
          logout();
          onNavigate?.();
        }}
      >
        Выйти
      </button>
    </aside>
  );
}

export default SidebarNav;
