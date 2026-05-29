import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ChatComposer from '../../components/ChatComposer';
import MessageBubble from '../../components/MessageBubble';
import SectionHeader from '../../components/SectionHeader';
import { messagesAPI } from '../../api/chats';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// API utility for auth
const getAuthToken = () => localStorage.getItem('auth_token');

const apiRequest = async (endpoint, opts = {}) => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Token ${token}` }),
      ...opts.headers,
    },
  });

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.non_field_errors?.[0] || `Ошибка ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

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
    chat_type: c.chat_type,
    members,
    last_message: c.last_message,
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
  tag: m.classification?.label || m.message_type
});

export default function DirectChatsPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();

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
  const [isSending, setIsSending] = useState(false);

  const pollRef = useRef(null);
  const chatPollRef = useRef(null);
  const endRef = useRef(null);
  const pendingMessagesRef = useRef([]);
  const chatMetaRef = useRef({});

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

  // Автоскролл к последнему сообщению
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Синхронизация рефа для актуальных pending-сообщений
  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

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

        setChats(formattedChats);
        setChatMeta(formattedChats.reduce((meta, chat) => {
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
  }, [myId, chatId]);

  // Загрузка сообщений для выбранного чата с опросом
  useEffect(() => {
    if (!chatId || !myId) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
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
        setMessageError(null);
      } catch (e) {
        console.error('Ошибка загрузки сообщений:', e);
        if (!e.message.includes('404')) {
          setMessageError('Не удалось загрузить сообщения: ' + e.message);
        }
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // Опрос для обновления сообщений каждые 3 секунды
    pollRef.current = setInterval(fetchMessages, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chatId, myId]);

  useEffect(() => {
    if (!chatId) return;

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
        ? { ...chat, hasUnread: false, isNewChat: false }
        : chat
    )));
  }, [chatId]);

  // Отправка сообщения
  const handleSend = async (text) => {
    if (!chatId || !text.trim() || !myId || isSending) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();
    const optimisticMessage = {
      id: tempId,
      author: 'Вы',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      text,
      isOptimistic: true,
      isOwn: true,
      optimisticCreatedAt,
      created_at: optimisticCreatedAt,
      tag: 'default',
    };

    // Оптимистичное обновление UI
    setMessages(prev => [...prev, optimisticMessage]);
    setPendingMessages(prev => [...prev, optimisticMessage]);
    setIsSending(true);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      const messageData = {
        chat: parseInt(chatId),
        text,
        message_type: 'default'
      };

      const res = await apiRequest('/messages/', {
        method: 'POST',
        body: JSON.stringify(messageData)
      });

      if (res) {
        setPendingMessages(prev => prev.filter((pending) => pending.id !== tempId));

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
        setChats(formattedChats);
      }
    } catch (e) {
      console.error('Ошибка отправки сообщения:', e);
      setMessageError('Не удалось отправить сообщение: ' + e.message);
      // Пометить сообщение как ошибка
      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, error: true, isOwn: true } : m)
      );
    } finally {
      setIsSending(false);
    }
  };

  // Выбор чата
  const handleSelectChat = (id) => {
    setLastSelectedChatId(String(id));
    localStorage.setItem('last_direct_chat_id', String(id));
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

  // Получить данные выбранного чата
  const selectedChat = chats.find(c => String(c.id) === chatId) ||
    (chatId && state ? {
      id: chatId,
      name: state.contactName || 'Диалог',
      position: '',
      status: 'Онлайн',
      preview: '',
      initials: state.contactInitials || '?'
    } : null);

  // Представление с открытым чатом
  if (chatId) {
    return (
      <div className="workspace workspace--messenger">
        <section className="panel panel--chat panel--chat-only">
          <div className="chat-toolbar chat-toolbar--stack">
            <div className="chat-toolbar__head">
              <button
                className="secondary-button secondary-button--back"
                type="button"
                onClick={() => navigate('/app/direct')}
              >
                Назад к списку
              </button>
              <div>
                <strong>{selectedChat?.name}</strong>
                <p>{selectedChat?.position}</p>
              </div>
            </div>
          </div>

          <div className="messages-feed">
            {loadingMessages && messages.length === 0 && (
              <div className="contacts-empty">Загрузка сообщений...</div>
            )}
            {messageError && (
              <div className="contacts-error">{messageError}</div>
            )}
            {!loadingMessages && messages.length === 0 && (
              <div className="contacts-empty" style={{ padding: '40px' }}>
                Начните диалог — напишите первое сообщение
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                className={msg.isOptimistic ? 'message--optimistic' : msg.error ? 'message--error' : ''}
              />
            ))}
            <div ref={endRef} />
          </div>

          <ChatComposer
            placeholder={`Сообщение для ${selectedChat?.name}`}
            onSend={handleSend}
            disabled={loadingMessages || isSending}
          />
        </section>
      </div>
    );
  }

  // Представление только со списком чатов
  return (
    <div className="workspace workspace--split">
      <section className="panel panel--list panel--list-only">
        <SectionHeader title="Личные сообщения" subtitle="Личные диалоги с участниками команды" />
        {loading && <div className="contacts-empty">Загрузка...</div>}
        {error && <div className="contacts-error">{error}</div>}
        {!loading && chats.length === 0 && (
          <div className="contacts-empty" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <h3>У вас пока нет личных чатов</h3>
            <p style={{ color: 'var(--text-soft)', marginBottom: '24px' }}>
              Начните диалог через страницу контактов
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => navigate('/app/contacts')}
            >
              Перейти к контактам
            </button>
          </div>
        )}
        <div className="list-stack">
          {chats.map((chat) => (
            <button
              className={`chat-card chat-card--button ${String(chat.id) === String(lastSelectedChatId) ? 'chat-card--active' : ''}`}
              key={chat.id}
              type="button"
              onClick={() => handleSelectChat(chat.id)}
            >
              <div className="chat-card__top">
                <h3>{chat.name}</h3>
                <span className="status-text">{chat.status}</span>
              </div>
              <p>{chat.preview}</p>
              <small>{chat.position}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}