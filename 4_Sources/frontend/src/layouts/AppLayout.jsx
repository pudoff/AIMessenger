import { Outlet, useLocation } from 'react-router-dom';
import SidebarNav from '../components/SidebarNav';
import { request as apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUnread } from '../context/UnreadContext';
import { useEffect, useState } from 'react';

const getActiveChat = (pathname) => {
  const directMatch = pathname.match(/^\/app\/direct\/([^/]+)/);
  if (directMatch) {
    return { scope: 'direct', id: directMatch[1] };
  }

  const groupMatch = pathname.match(/^\/app\/groups\/([^/]+)/);
  if (groupMatch) {
    return { scope: 'group', id: groupMatch[1] };
  }

  const corporateMatch = pathname.match(/^\/app\/community\/([^/]+)/);
  if (corporateMatch) {
    return { scope: 'corporate', id: corporateMatch[1] };
  }

  return { scope: null, id: null };
};

function AppLayout() {
  const location = useLocation();
  const { currentUser } = useAuth();
  const { decorateChatsWithUnread } = useUnread();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const syncUnread = async () => {
      const activeChat = getActiveChat(location.pathname);

      try {
        const [directRes, groupRes, corporateRes] = await Promise.all([
          apiRequest('/chats/?type=direct'),
          apiRequest('/chats/?type=group'),
          apiRequest('/chats/?type=corporate'),
        ]);

        decorateChatsWithUnread('direct', directRes?.results || directRes || [], {
          activeChatId: activeChat.scope === 'direct' ? activeChat.id : null,
          currentUserId: currentUser.id,
        });
        decorateChatsWithUnread('group', groupRes?.results || groupRes || [], {
          activeChatId: activeChat.scope === 'group' ? activeChat.id : null,
          currentUserId: currentUser.id,
        });
        decorateChatsWithUnread('corporate', corporateRes?.results || corporateRes || [], {
          activeChatId: activeChat.scope === 'corporate' ? activeChat.id : null,
          currentUserId: currentUser.id,
        });
      } catch (error) {
        console.error('Не удалось синхронизировать непрочитанные сообщения:', error);
      }
    };

    syncUnread();
    const timerId = setInterval(syncUnread, 10000);

    return () => clearInterval(timerId);
  }, [currentUser?.id, decorateChatsWithUnread, location.pathname]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app-shell ${isMobileNavOpen ? 'app-shell--nav-open' : ''}`}>
      <button
        className="mobile-nav-toggle"
        type="button"
        onClick={() => setIsMobileNavOpen((value) => !value)}
        aria-label={isMobileNavOpen ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={isMobileNavOpen}
      >
        {isMobileNavOpen ? '×' : '☰'}
      </button>
      <button
        className="mobile-nav-backdrop"
        type="button"
        aria-label="Закрыть меню"
        onClick={() => setIsMobileNavOpen(false)}
      />
      <SidebarNav onNavigate={() => setIsMobileNavOpen(false)} />
      <div className="app-shell__content">
        {/* StoriesBar отключен до следующей итерации MVP. */}
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
