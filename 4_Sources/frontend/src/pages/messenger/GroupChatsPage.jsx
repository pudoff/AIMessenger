import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatComposer from '../../components/ChatComposer';
import MessageBubble from '../../components/MessageBubble';
import SectionHeader from '../../components/SectionHeader';
import { chatsAPI, messagesAPI } from '../../api/chats';
import { contactsAPI } from '../../api/contacts';

// API utility for auth
const getAuthToken = () => localStorage.getItem('auth_token');

const apiRequest = async (endpoint, opts = {}) => {
  const token = getAuthToken();
  const response = await fetch(`/api${endpoint}`, {
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

// Форматирование группы
const formatGroup = (g) => ({
  id: g.id,
  name: g.title,
  description: g.description || 'Групповой чат',
  members: g.members_count || 0,
  lastMessage: g.last_message ? {
    text: g.last_message.text,
    time: new Date(g.last_message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    author: g.last_message.sender_username,
  } : null,
  preview: g.last_message?.text || 'Нет сообщений',
  position: `Участников: ${g.members_count || 0}`,
});

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
  classification: m.classification
});

function GroupChatsPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', participantIds: [] });
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Для чата группы
  const [messages, setMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const pollRef = useRef(null);
  const endRef = useRef(null);
  const pendingMessagesRef = useRef([]);

  // Получение текущего пользователя
  const [myId, setMyId] = useState(null);
  useEffect(() => {
    const initUser = async () => {
      try {
        const user = await apiRequest('/me/');
        setMyId(user?.id);
      } catch (e) {
        console.error('Не удалось получить текущего пользователя:', e);
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

  // Загрузка сообщений для выбранной группы с опросом
  useEffect(() => {
    if (!chatId || !myId) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await messagesAPI.getList(chatId, 1, 200);
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
    pollRef.current = setInterval(fetchMessages, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chatId, myId]);

  // Загрузка групп
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await apiRequest('/chats/?type=group');
        const list = data.results || data || [];
        setGroups(list.map(formatGroup));
        setError(null);
      } catch (e) {
        console.error('Ошибка загрузки групп:', e);
        setError('Не удалось загрузить группы: ' + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  // Загрузка контактов для создания группы
  const loadContactsForCreate = async () => {
    if (contacts.length > 0) return;
    setLoadingContacts(true);
    try {
      const data = await contactsAPI.getList();
      const list = Array.isArray(data) ? data : data.results || [];
      setContacts(list.map(c => ({
        id: c.contact,
        name: `${c.contact_detail?.first_name || ''} ${c.contact_detail?.last_name || ''}`.trim() || c.contact_detail?.username || 'Без имени',
      })));
    } catch (e) {
      console.error('Ошибка загрузки контактов:', e);
    } finally {
      setLoadingContacts(false);
    }
  };

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
    };

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
        setMessages(prev =>
          prev.map(m => m.id === tempId ? formatMessage(res, myId) : m)
        );
        setMessageError(null);
      }
    } catch (e) {
      console.error('Ошибка отправки сообщения:', e);
      setMessageError('Не удалось отправить сообщение: ' + e.message);
      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, error: true, isOwn: true } : m)
      );
    } finally {
      setIsSending(false);
    }
  };

  // Выбор группы
  const handleSelectGroup = (id) => {
    navigate(`/app/group/${id}`);
  };

  // Создание группы
  const handleCreateGroup = async () => {
    if (!createForm.title.trim()) return;

    try {
      const groupData = {
        chat_type: 'group',
        title: createForm.title,
        description: createForm.description,
        participant_ids: createForm.participantIds,
      };

      const newGroup = await chatsAPI.create(groupData);
      const formatted = formatGroup(newGroup);
      setGroups(prev => [formatted, ...prev]);
      setShowCreateForm(false);
      setCreateForm({ title: '', description: '', participantIds: [] });
      navigate(`/app/group/${newGroup.id}`);
    } catch (e) {
      console.error('Ошибка создания группы:', e);
      alert('Не удалось создать группу: ' + e.message);
    }
  };

  // Режим создания группы
  if (showCreateForm) {
    return (
      <div className="workspace workspace--contacts">
        <section className="panel panel--list">
          <SectionHeader title="Создание группы" subtitle="Выберите участников и настройте группу" />
          <div className="form-stack">
            <div className="form-group">
              <label htmlFor="title">Название группы</label>
              <input
                id="title"
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Введите название группы"
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Описание (необязательно)</label>
              <textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Описание группы"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Участники</label>
              {loadingContacts ? (
                <div>Загрузка контактов...</div>
              ) : (
                <div className="checkbox-list">
                  {contacts.map(contact => (
                    <label key={contact.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={createForm.participantIds.includes(contact.id)}
                        onChange={(e) => {
                          const id = contact.id;
                          setCreateForm(prev => ({
                            ...prev,
                            participantIds: e.target.checked
                              ? [...prev.participantIds, id]
                              : prev.participantIds.filter(pid => pid !== id)
                          }));
                        }}
                      />
                      {contact.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCreateForm(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleCreateGroup}
                disabled={!createForm.title.trim()}
              >
                Создать группу
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // 🔹 РЕЖИМ ЧАТА ГРУППЫ (если chatId есть)
  if (chatId) {
    const selectedGroup = groups.find(g => String(g.id) === chatId);
    
    return (
      <div className="workspace workspace--split">
        {/* Левая панель: список групп */}
        <section className="panel panel--list">
          <SectionHeader
            title="Групповые чаты"
            subtitle="Рабочие группы и проектные обсуждения"
            actions={
              <button
                type="button"
                className="primary-button primary-button--small"
                onClick={() => {
                  setShowCreateForm(true);
                  loadContactsForCreate();
                }}
              >
                Создать группу
              </button>
            }
          />
          <div className="list-stack">
            {loading && <div className="contacts-empty">Загрузка...</div>}
            {error && <div className="contacts-empty">{error}</div>}
            {!loading && !error && groups.length === 0 && (
              <div className="contacts-empty">
                Нет групповых чатов. <br />
                <button
                  className="primary-button"
                  style={{ marginTop: '12px' }}
                  type="button"
                  onClick={() => {
                    setShowCreateForm(true);
                    loadContactsForCreate();
                  }}
                >
                  Создать первую группу
                </button>
              </div>
            )}
            {groups.map((group) => (
              <button
                className={`chat-card chat-card--button ${String(group.id) === chatId ? 'chat-card--active' : ''}`}
                key={group.id}
                type="button"
                onClick={() => handleSelectGroup(group.id)}
              >
                <div className="chat-card__top">
                  <h3>{group.name}</h3>
                  <span className="badge badge--soft">{group.members}</span>
                </div>
                <p>{group.description}</p>
                <small>{group.members} участников</small>
              </button>
            ))}
          </div>
        </section>

        {/* Правая панель: чат */}
        <section className="panel panel--chat">
          <div className="chat-toolbar chat-toolbar--stack">
            <div className="chat-toolbar__head">
              <button className="secondary-button secondary-button--back" type="button" onClick={() => navigate('/app/groups')}>
                Назад к списку
              </button>
              <div>
                <strong>{selectedGroup?.name || 'Групповой чат'}</strong>
                <p>{selectedGroup?.description || ''}</p>
              </div>
            </div>
          </div>

          <div className="messages-feed">
            {loadingMessages && messages.length === 0 && <div className="contacts-empty">Загрузка...</div>}
            {messageError && <div className="contacts-error">{messageError}</div>}
            {!loadingMessages && messages.length === 0 && (
              <div className="contacts-empty" style={{ padding: '40px' }}>
                Начните обсуждение — напишите первое сообщение
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
            placeholder={`Сообщение в ${selectedGroup?.name || 'группу'}`}
            onSend={handleSend}
            disabled={loadingMessages || isSending}
          />
        </section>
      </div>
    );
  }

// 🔹 РЕЖИМ СПИСКА ГРУПП (если chatId нет)
return (
  <div className="workspace workspace--split">
    <section className="panel panel--list panel--list-only">
      {/* Заголовок с кнопкой */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between', 
        gap: '16px',
        marginBottom: '20px',
        padding: '0 20px'
      }}>
        <div>
          <h1 style={{ 
            margin: '0 0 8px', 
            fontSize: '1.8rem',
            fontWeight: '700'
          }}>
            Групповые чаты
          </h1>
          <p style={{ 
            margin: '0', 
            color: 'var(--text-soft)',
            fontSize: '0.95rem'
          }}>
            Рабочие группы и проектные обсуждения
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setShowCreateForm(true);
            loadContactsForCreate();
          }}
          style={{ 
            whiteSpace: 'nowrap',
            padding: '10px 20px',
            height: 'fit-content',
            alignSelf: 'flex-start'
          }}
        >
          Создать группу
        </button>
      </div>

      <div className="list-stack" style={{ padding: '0 20px' }}>
        {loading && <div className="contacts-empty">Загрузка...</div>}
        {error && <div className="contacts-error">{error}</div>}
        {!loading && !error && groups.length === 0 && (
          <div className="contacts-empty">
            Нет групповых чатов. <br />
            <button
              className="primary-button"
              style={{ marginTop: '12px' }}
              type="button"
              onClick={() => {
                setShowCreateForm(true);
                loadContactsForCreate();
              }}
            >
              Создать первую группу
            </button>
          </div>
        )}
        {groups.map((group) => (
          <button
            className={`chat-card chat-card--button`}
            key={group.id}
            type="button"
            onClick={() => handleSelectGroup(group.id)}
          >
            <div className="chat-card__top">
              <h3>{group.name}</h3>
              <span className="badge badge--soft">{group.members}</span>
            </div>
            <p>{group.description}</p>
            <small>{group.members} участников</small>
          </button>
        ))}
      </div>
    </section>

    <section className="panel panel--chat">
      <div className="chat-toolbar chat-toolbar--stack">
        <div className="chat-toolbar__head">
          <strong>Выберите группу</strong>
          <p>Для начала общения</p>
        </div>
      </div>

      <div className="messages-feed">
        <div className="messages-empty">
          Выберите групповой чат слева или создайте новый.
        </div>
      </div>
    </section>
  </div>
);
}

export default GroupChatsPage;