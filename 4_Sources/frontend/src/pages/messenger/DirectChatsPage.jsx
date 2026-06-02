import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { chatsAPI, messagesAPI } from '../../api/chats';
import { request as apiRequest } from '../../api/client';
import ChatPageShell from '../../components/chat/ChatPageShell';
import ChatHeader from '../../components/chat/ChatHeader';
import ChatList from '../../components/chat/ChatList';
import ChatRoom from '../../components/chat/ChatRoom';
import SectionHeader from '../../components/SectionHeader';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useUnread } from '../../context/UnreadContext';

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

// Форматирование чата
const formatChat = (c, myId) => {
  const members = c.members || [];
  const other = members.find(m => String(m.user) !== String(myId));
  const detail = other?.user_detail || {};
  const name = [detail.first_name, detail.last_name].filter(Boolean).join(' ').trim() || detail.username || 'Чат';

  return {
    id: c.id,
    name,
    position: detail.role === 'admin' ? 'Администратор' : 'Участник',
    status: 'Онлайн',
    preview: c.last_message?.text || 'Нет сообщений',
    initials: (detail.first_name?.[0] || detail.last_name?.[0] || detail.username?.[0] || '?').toUpperCase(),
    avatar_url: detail.avatar_url || null,
    chat_type: c.chat_type,
    members,
    last_message: c.last_message,
    unread_count: c.unread_count,
    last_read_message: c.last_read_message,
    last_read_at: c.last_read_at,
    other_user: other?.user
  };
};

const MESSAGE_PAGE_SIZE = 200;

// Форматирование сообщения
const formatMessage = (m, myId) => ({
  id: m.id,
  author: m.sender_username || 'Пользователь',
  time: new Date(m.created_at || m.optimisticCreatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  createdAtRaw: m.created_at || m.optimisticCreatedAt,
  text: m.text,
  isOwn: myId ? String(m.sender) === String(myId) : false,
  message_type: m.message_type,
  task_status: m.task_status,
  classification: m.classification,
  attachments: m.attachments || [],
  sender_avatar_url: m.sender_avatar_url || null,
  tag: m.classification?.label || m.message_type,
  readStatus: m.isOptimistic ? 'sent' : (m.is_read ? 'read' : 'sent'),
});

export default function DirectChatsPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const {
    decorateChatsWithUnread,
    markChatRead,
    registerOutgoingMessage,
  } = useUnread();

  const queryParams = new URLSearchParams(location.search);
  const tabFromQuery = queryParams.get('tab');
  const savedTab = sessionStorage.getItem('messenger_active_tab') || 'direct';
  const backTab = tabFromQuery || savedTab;

  const [myId, setMyId] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [chatMeta, setChatMeta] = useState({});
  const [lastSelectedChatId, setLastSelectedChatId] = useState(() => localStorage.getItem('last_direct_chat_id'));
  const [hasLoadedChats, setHasLoadedChats] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [messageError, setMessageError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState([]);
  const [semanticLoading, setSemanticLoading] = useState(false);

  const pollRef = useRef(null);
  const chatPollRef = useRef(null);
  const endRef = useRef(null);
  const pendingMessagesRef = useRef([]);
  const chatMetaRef = useRef({});
  const messagesRef = useRef([]);
  const lastMarkedReadMessageRef = useRef(null);
  const hasLoadedMessagesRef = useRef(false);
  const isFetchingMessagesRef = useRef(false);

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

  // Автоскролл к последнему сообщению только при новых сообщениях
  const prevMessagesLengthRef = useRef(0);
  
  useEffect(() => {
    // Скроллим вниз только если количество сообщений увеличилось (новые сообщения)
    if (messages.length > prevMessagesLengthRef.current && messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Синхронизация рефа для актуальных pending-сообщений
  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    lastMarkedReadMessageRef.current = null;
    hasLoadedMessagesRef.current = false;
    isFetchingMessagesRef.current = false;
    setLoadingMessages(false);
  }, [chatId]);

  // Синхронизация рефа для текущих меток чатов
  useEffect(() => {
    chatMetaRef.current = chatMeta;
  }, [chatMeta]);

  // Загрузка списка личных чатов с опросом
  useEffect(() => {
    if (!myId) return;

    const fetchChats = async () => {
      try {
        const data = await apiRequest('/chats/?type=direct');
        const list = data.results || data || [];
        const prevMeta = chatMetaRef.current || {};
        const firstLoad = !hasLoadedChats;

        const formattedChats = list
          .filter(c => c.chat_type === 'direct')
          .map((c) => {
            const lastMessageId = c.last_message?.id;
            const existingMeta = prevMeta[c.id] || {};
            const isActive = String(c.id) === String(chatId);

            const hasUnread = existingMeta.hasUnread || (!firstLoad && !isActive && existingMeta.lastMessageId && lastMessageId && existingMeta.lastMessageId !== lastMessageId);
            const isNewChat = existingMeta.isNewChat || (!firstLoad && !existingMeta);

            return {
              ...formatChat(c, myId),
              hasUnread,
              isNewChat,
              lastMessageId,
            };
          })
          .sort((a, b) => {
            const aTime = a.last_message?.created_at || 0;
            const bTime = b.last_message?.created_at || 0;
            return new Date(bTime) - new Date(aTime);
          });

        const unreadChats = decorateChatsWithUnread(
          'direct',
          formattedChats,
          { activeChatId: chatId, currentUserId: myId },
        );

        setChats(unreadChats);
        setChatMeta(unreadChats.reduce((meta, chat) => {
          meta[chat.id] = {
            lastMessageId: chat.lastMessageId,
            hasUnread: chat.hasUnread,
            isNewChat: chat.isNewChat,
          };
          return meta;
        }, {}));
        setHasLoadedChats(true);
        setError(null);
      } catch (e) {
        console.error('Ошибка загрузки чатов:', e);
        setError('Не удалось загрузить список чатов: ' + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();

    // Опрос для обновления списка чатов каждые 5 секунд
    chatPollRef.current = setInterval(fetchChats, 5000);

    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [myId, chatId, decorateChatsWithUnread]);

  // Загрузка сообщений для выбранного чата с опросом
  useEffect(() => {
    if (!chatId || !myId) return;

    const fetchMessages = async () => {
      if (isFetchingMessagesRef.current) {
        return;
      }

      isFetchingMessagesRef.current = true;
      const showInitialLoader = !hasLoadedMessagesRef.current && messagesRef.current.length === 0;
      if (showInitialLoader) {
        setLoadingMessages(true);
      }
      try {
        const data = await messagesAPI.getList(chatId, 1, MESSAGE_PAGE_SIZE);
        const list = data.results || data || [];
        const fetchedMessages = list.map(m => formatMessage(m, myId));

        const mergedMessages = [
          ...fetchedMessages,
          ...pendingMessagesRef.current.filter((pending) => {
            return !fetchedMessages.some((message) => {
              return (
                message.isOwn &&
                message.text === pending.text &&
                new Date(message.createdAtRaw).getTime() >= new Date(pending.optimisticCreatedAt).getTime()
              );
            });
          }),
        ].sort((a, b) => new Date(a.createdAtRaw).getTime() - new Date(b.createdAtRaw).getTime());

        setMessages(mergedMessages);
        hasLoadedMessagesRef.current = true;
        const lastMessage = mergedMessages[mergedMessages.length - 1];
        if (lastMessage?.id) {
          if (String(lastMarkedReadMessageRef.current) === String(lastMessage.id)) {
            setMessageError(null);
            return;
          }
          lastMarkedReadMessageRef.current = lastMessage.id;
          chatsAPI.markRead(chatId, lastMessage.id).catch((e) => {
            lastMarkedReadMessageRef.current = null;
            console.error('Не удалось отметить личный чат прочитанным:', e);
          });
          markChatRead('direct', chatId, lastMessage.id);
          setChats((prev) => prev.map((chat) => (
            String(chat.id) === String(chatId)
              ? { ...chat, hasUnread: false, unreadCount: 0 }
              : chat
          )));
        }
        setMessageError(null);
      } catch (e) {
        console.error('Ошибка загрузки сообщений:', e);
        if (!e.message.includes('404')) {
          setMessageError('Не удалось загрузить сообщения: ' + e.message);
        }
      } finally {
        isFetchingMessagesRef.current = false;
        if (showInitialLoader) {
          setLoadingMessages(false);
        }
      }
    };

    fetchMessages();

    // Опрос для обновления сообщений каждые 3 секунды
    pollRef.current = setInterval(fetchMessages, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chatId, myId, markChatRead]);

  useEffect(() => {
    if (!chatId) return;

    markChatRead('direct', chatId);
    setChatMeta((prev) => ({
      ...prev,
      [chatId]: {
        ...(prev[chatId] || {}),
        hasUnread: false,
        isNewChat: false,
      },
    }));
    setChats((prev) => prev.map((chat) => (
      String(chat.id) === String(chatId)
        ? { ...chat, hasUnread: false, isNewChat: false, unreadCount: 0 }
        : chat
    )));
  }, [chatId, markChatRead]);

  // Отправка сообщения
  const handleSend = async (text, files = []) => {
    if (!text.trim() && files.length === 0) return;
    if (!chatId) {
      setMessageError('Чат не выбран.');
      return;
    }
    if (!myId) {
      setMessageError('Не удалось определить текущего пользователя. Обновите страницу или войдите заново.');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();
    const optimisticMessage = {
      id: tempId,
      author: 'Вы',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      text,
      attachments: files.map((file) => ({ id: `${tempId}-${file.name}`, original_name: file.name })),
      isOptimistic: true,
      isOwn: true,
      optimisticCreatedAt,
      created_at: optimisticCreatedAt,
      tag: 'default',
      readStatus: 'sent',
      sender_avatar_url: currentUser?.avatar_url || null,
    };

    // Оптимистичное обновление UI
    setMessages(prev => [...prev, optimisticMessage]);
    setPendingMessages(prev => [...prev, optimisticMessage]);
    registerOutgoingMessage('direct', chatId, tempId);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      const messageData = {
        chat: parseInt(chatId),
        text,
        message_type: 'default',
        attachments: files,
      };

      const res = await messagesAPI.send(messageData);

      if (res) {
        setPendingMessages(prev => prev.filter((pending) => pending.id !== tempId));
        registerOutgoingMessage('direct', chatId, res.id);

        // Заменить оптимистичное сообщение на реальное
        setMessages(prev =>
          prev.map(m => m.id === tempId ? formatMessage(res, myId) : m)
        );
        setMessageError(null);

        // Обновить список чатов (чтобы обновился preview и время)
        const chatsData = await apiRequest('/chats/?type=direct');
        const list = chatsData.results || chatsData || [];
        const formattedChats = list
          .filter(c => c.chat_type === 'direct')
          .map(c => formatChat(c, myId))
          .sort((a, b) => {
            const aTime = a.last_message?.created_at || 0;
            const bTime = b.last_message?.created_at || 0;
            return new Date(bTime) - new Date(aTime);
          });
        setChats(decorateChatsWithUnread(
          'direct',
          formattedChats,
          { activeChatId: chatId, currentUserId: myId },
        ));
      }
    } catch (e) {
      console.error('Ошибка отправки сообщения:', e);
      setMessageError('Не удалось отправить сообщение: ' + e.message);
      // Пометить сообщение как ошибка
      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, error: true, isOwn: true } : m)
      );
    }
  };

  // Выбор чата
  const handleSelectChat = (id) => {
    setLastSelectedChatId(String(id));
    localStorage.setItem('last_direct_chat_id', String(id));
    chatsAPI.markRead(id).catch((e) => {
      console.error('Не удалось отметить личный чат прочитанным:', e);
    });
    markChatRead('direct', id);
    setChatMeta((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        hasUnread: false,
        isNewChat: false,
      },
    }));
    navigate(`/app/direct/${id}`, { replace: true });
  };

  const handleSemanticSearch = async (event) => {
    event.preventDefault();
    const query = semanticQuery.trim();
    if (!query || !chatId) return;
    setSemanticLoading(true);
    try {
      const data = await messagesAPI.semanticSearch({ q: query, chat: chatId, limit: 8 });
      setSemanticResults(data.results || []);
    } catch (e) {
      setMessageError(`Не удалось выполнить семантический поиск: ${e.message}`);
    } finally {
      setSemanticLoading(false);
    }
  };

  const semanticSearchNode = (
    <form className="chat-semantic-search" onSubmit={handleSemanticSearch}>
      <input
        value={semanticQuery}
        onChange={(event) => setSemanticQuery(event.target.value)}
        placeholder="Семантический поиск в этом чате"
      />
      <button className="secondary-button" type="submit" disabled={semanticLoading || !semanticQuery.trim()}>
        {semanticLoading ? 'Поиск...' : 'Найти'}
      </button>
      {semanticResults.length > 0 && (
        <div className="chat-semantic-search__results">
          {semanticResults.map((result) => (
            <button
              type="button"
              key={result.message_id}
              onClick={() => setSemanticQuery(result.text)}
            >
              <strong>{Math.max(0, Math.min(100, Math.round((result.similarity_score || 0) * 100)))}%</strong>
              <span>{result.text}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );

  // Получить данные выбранного чата
  const selectedChat = chats.find(c => String(c.id) === chatId) ||
    (chatId && location.state ? {
      id: chatId,
      name: location.state.contactName || 'Диалог',
      position: '',
      status: 'Онлайн',
      preview: '',
      initials: location.state.contactInitials || '?',
      avatar_url: location.state.contactAvatarUrl || null,
    } : null);

  // Представление с открытым чатом
  if (chatId) {
    return (
      <ChatPageShell
        left={null}
        right={(
          <section className="panel panel--chat-only" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ChatHeader
              title={selectedChat?.name}
              subtitle={selectedChat?.position}
              onBack={() => navigate('/app/direct')}
              avatars={selectedChat ? (
                <Avatar
                  src={selectedChat.avatar_url}
                  initials={selectedChat.initials}
                  title={selectedChat.name}
                  className="avatar--circle"
                />
              ) : null}
              compact
            />
            <ChatRoom
              messages={messages}
              loadingMessages={loadingMessages}
              messageError={messageError}
              onSend={handleSend}
              placeholder={`Сообщение для ${selectedChat?.name}`}
              endRef={endRef}
              composerDisabled={false}
              searchNode={semanticSearchNode}
            />
          </section>
        )}
        split={false}
      />
    );
  }

  const filteredChats = chats.filter(chat =>
    searchQuery.trim() === '' ||
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Представление только со списком чатов
  return (
    <ChatPageShell
      left={(
        <section className="panel panel--list panel--list-only">
          <SectionHeader title="Личные сообщения" subtitle="Личные диалоги с участниками команды" />
          <div className="chat-search-wrapper">
            <input
              type="text"
              placeholder="Поиск чатов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chat-search-input"
            />
          </div>
          <ChatList
            items={filteredChats}
            selectedId={lastSelectedChatId}
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
                    <h3>У вас пока нет личных чатов</h3>
                    <p className="contacts-empty__text">
                      Начните диалог через страницу контактов
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => navigate('/app/contacts')}
                    >
                      Перейти к контактам
                    </button>
                  </>
                )}
              </div>
            )}
          />
        </section>
      )}
      right={null}
      split={true}
    />
  );
}
