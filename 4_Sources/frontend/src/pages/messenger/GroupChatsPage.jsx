import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatComposer from '../../components/ChatComposer';
import MessageBubble from '../../components/MessageBubble';
import SectionHeader from '../../components/SectionHeader';
import { chatsAPI, messagesAPI } from '../../api/chats';
import { contactsAPI } from '../../api/contacts';
import ChatPageShell from '../../components/chat/ChatPageShell';
import ChatHeader from '../../components/chat/ChatHeader';
import ChatList from '../../components/chat/ChatList';
import ChatRoom from '../../components/chat/ChatRoom';

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
  classification: m.classification,
  tag: m.classification?.label || m.message_type
});

function GroupChatsPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [lastSelectedGroupId, setLastSelectedGroupId] = useState(() => localStorage.getItem('last_group_chat_id'));
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
      tag: 'default',
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
    setLastSelectedGroupId(String(id));
    localStorage.setItem('last_group_chat_id', String(id));
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
      setLastSelectedGroupId(String(newGroup.id));
      localStorage.setItem('last_group_chat_id', String(newGroup.id));
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

  // Режим выбранного группового чата
  if (chatId) {
    const selectedGroup = groups.find(g => String(g.id) === chatId);

    return (
      <ChatPageShell
        left={null}
        right={(
          <>
            <ChatHeader title={selectedGroup?.name || 'Групповой чат'} subtitle={selectedGroup?.description || ''} onBack={() => navigate('/app/groups')} />
            <ChatRoom
              messages={messages}
              loadingMessages={loadingMessages}
              messageError={messageError}
              onSend={handleSend}
              placeholder={`Сообщение в ${selectedGroup?.name || 'группу'}`}
              endRef={endRef}
              composerDisabled={loadingMessages || isSending}
            />
          </>
        )}
        split={false}
      />
    );
  }

// 🔹 РЕЖИМ СПИСКА ГРУПП (если chatId нет)
  return (
    <ChatPageShell
      left={(
        <section className="panel panel--list panel--list-only">
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

          <ChatList
            items={groups}
            selectedId={lastSelectedGroupId}
            onSelect={handleSelectGroup}
            loading={loading}
            error={error}
            emptyNode={(
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
          />
        </section>
      )}
      right={null}
      split={true}
    />
  );
}

export default GroupChatsPage;