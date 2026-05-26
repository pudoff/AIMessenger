import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatPageShell from '../../components/chat/ChatPageShell';
import ChatList from '../../components/chat/ChatList';
import SectionHeader from '../../components/SectionHeader';
import { request as apiRequest } from '../../api/client';

// Получение текущего пользователя
const getCurrentUser = async () => {
  try {
    const user = await apiRequest('/me/');
    return user?.id;
  } catch (e) {
    console.error('Не удалось получить текущего пользователя:', e);
    return null;
  }
};

// Форматирование личного чата
const formatDirectChat = (c, myId) => {
  const members = c.members || [];
  const other = members.find(m => String(m.user) !== String(myId));
  const detail = other?.user_detail || {};
  const name = [detail.first_name, detail.last_name].filter(Boolean).join(' ').trim() || detail.username || 'Чат';

  return {
    id: String(c.id),
    name,
    position: detail.role === 'admin' ? 'Администратор' : 'Участник',
    status: 'Онлайн',
    preview: c.last_message?.text || 'Нет сообщений',
    initials: (detail.first_name?.[0] || detail.last_name?.[0] || detail.username?.[0] || '?').toUpperCase(),
    chat_type: 'direct',
    last_message: c.last_message,
  };
};

// Форматирование группы
const formatGroup = (g) => ({
  id: String(g.id),
  name: g.title,
  description: g.description || 'Групповой чат',
  members: g.members_count || 0,
  preview: g.last_message?.text || 'Нет сообщений',
  position: `Участников: ${g.members_count || 0}`,
  chat_type: 'group',
});

// Форматирование сообщества
const formatCommunity = (c) => ({
  id: String(c.id),
  name: c.title,
  description: c.description || 'Корпоративное сообщество',
  members: c.members_count || 0,
  category: 'Корпоративное',
  preview: 'Сообщество',
  position: `${c.members_count || 0} участников`,
  chat_type: 'corporate',
});

function MessengerPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [allChats, setAllChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myId, setMyId] = useState(null);

  // Инициализация: получение ID текущего пользователя
  useEffect(() => {
    const initUser = async () => {
      try {
        const userId = await getCurrentUser();
        if (!userId) {
          setError('Не удалось определить текущего пользователя. Проверьте авторизацию.');
          setLoading(false);
          return;
        }
        setMyId(userId);
      } catch (e) {
        setError('Ошибка при получении профиля: ' + e.message);
        setLoading(false);
      }
    };
    initUser();
  }, []);

  // Загрузка всех чатов
  useEffect(() => {
    if (!myId) return;

    const fetchAllChats = async () => {
      try {
        const [directRes, groupRes, corporateRes] = await Promise.all([
          apiRequest('/chats/?type=direct'),
          apiRequest('/chats/?type=group'),
          apiRequest('/chats/?type=corporate'),
        ]);

        const directList = (directRes?.results || directRes || []).map(c => formatDirectChat(c, myId));
        const groupList = (groupRes?.results || groupRes || []).map(formatGroup);
        const corporateList = (corporateRes?.results || corporateRes || []).map(formatCommunity);

        const all = [...directList, ...groupList, ...corporateList].sort((a, b) => {
          const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
          const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
          return bTime - aTime;
        });

        setAllChats(all);
        setError(null);
      } catch (e) {
        console.error('Ошибка загрузки чатов:', e);
        setError('Не удалось загрузить чаты: ' + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllChats();

    // Опрос для обновления каждые 5 секунд
    const pollInterval = setInterval(fetchAllChats, 5000);
    return () => clearInterval(pollInterval);
  }, [myId]);

  // Фильтрация по поиску
  const filteredChats = allChats.filter(chat => {
    // Фильтр по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        chat.name.toLowerCase().includes(query) ||
        (chat.description && chat.description.toLowerCase().includes(query)) ||
        (chat.preview && chat.preview.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleSelectChat = (chatId) => {
    // chatId приходит просто ID, ищем тип чата
    const foundChat = allChats.find(c => String(c.id) === String(chatId));
    
    if (!foundChat) {
      console.error('[MessengerPage.handleSelectChat] Чат не найден:', chatId);
      return;
    }

    const chatType = foundChat.chat_type;

    let url = '';
    // Навигация в зависимости от типа чата с replace
    if (chatType === 'direct') {
      url = `/app/direct/${chatId}`;
      navigate(url, { replace: true });
    } else if (chatType === 'group') {
      url = `/app/groups/${chatId}`;
      navigate(url, { replace: true });
    } else if (chatType === 'corporate') {
      url = `/app/community/${chatId}`;
      navigate(url, { replace: true });
    } else {
      console.error('[MessengerPage.handleSelectChat] Неизвестный тип чата:', chatType);
      url = `/app/direct/${chatId}`;
      navigate(url, { replace: true });
    }
  };

  return (
    <ChatPageShell
      left={(
        <ChatList
          topNode={(
            <>
              <SectionHeader
                title="Мессенджер"
                subtitle="Все ваши чаты в одном месте"
              />

              {/* Поиск */}
              <div className="chat-search-wrapper">
                <input
                  type="text"
                  placeholder="Поиск чатов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="chat-search-input"
                />
              </div>
            </>
          )}
          items={filteredChats}
          selectedId={null}
          onSelect={handleSelectChat}
          loading={loading}
          error={error}
          emptyNode={(
            <div className="contacts-empty contacts-empty--large">
              {searchQuery ? (
                <>
                  <h3>Ничего не найдено</h3>
                  <p className="contacts-empty__text">
                    По запросу «{searchQuery}» чатов не найдено
                  </p>
                </>
              ) : (
                <>
                  <h3>У вас пока нет чатов</h3>
                  <p className="contacts-empty__text">
                    Начните диалог через страницу контактов или создайте группу
                  </p>
                  <div className="chat-search-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => navigate('/app/contacts')}
                    >
                      Контакты
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => navigate('/app/groups')}
                    >
                      Группы
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        />
      )}
      right={null}
      split={true}
    />
  );
}

export default MessengerPage;
