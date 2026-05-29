import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SectionHeader from '../../components/SectionHeader';
import { chatsAPI, messagesAPI } from '../../api/chats';
import { contactsAPI } from '../../api/contacts';
import { request as apiRequest } from '../../api/client';
import ChatPageShell from '../../components/chat/ChatPageShell';
import ChatHeader from '../../components/chat/ChatHeader';
import ChatList from '../../components/chat/ChatList';
import ChatRoom from '../../components/chat/ChatRoom';
import { useUnread } from '../../context/UnreadContext';

const formatGroup = (group) => ({
  id: group.id,
  name: group.title,
  description: group.description || 'Групповой чат',
  members: group.members_count || 0,
  lastMessage: group.last_message ? {
    text: group.last_message.text,
    time: new Date(group.last_message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    author: group.last_message.sender_username,
  } : null,
  preview: group.last_message?.text || 'Нет сообщений',
  position: `Участников: ${group.members_count || 0}`,
  last_message: group.last_message,
  unread_count: group.unread_count,
  last_read_message: group.last_read_message,
  last_read_at: group.last_read_at,
});

const formatMessage = (message, myId) => ({
  id: message.id,
  author: message.sender_username || 'Пользователь',
  time: new Date(message.created_at || message.optimisticCreatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  createdAtRaw: message.created_at || message.optimisticCreatedAt,
  text: message.text,
  isOwn: myId ? String(message.sender) === String(myId) : false,
  message_type: message.message_type,
  task_status: message.task_status,
  classification: message.classification,
  tag: message.classification?.label || message.message_type,
  readStatus: message.isOptimistic ? 'sent' : (message.is_read ? 'read' : 'sent'),
});

function GroupChatsPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const {
    decorateChatsWithUnread,
    markChatRead,
    registerOutgoingMessage,
  } = useUnread();

  const [groups, setGroups] = useState([]);
  const [lastSelectedGroupId, setLastSelectedGroupId] = useState(() => localStorage.getItem('last_group_chat_id'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', participantIds: [] });
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [messages, setMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [myId, setMyId] = useState(null);

  const pollRef = useRef(null);
  const groupsPollRef = useRef(null);
  const endRef = useRef(null);
  const pendingMessagesRef = useRef([]);

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

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

  useEffect(() => {
    if (!myId) return undefined;

    const fetchGroups = async () => {
      try {
        const data = await apiRequest('/chats/?type=group');
        const list = data.results || data || [];
        const formattedGroups = list.map(formatGroup);
        const groupsWithUnread = decorateChatsWithUnread(
          'group',
          formattedGroups,
          { activeChatId: chatId, currentUserId: myId },
        );

        setGroups(groupsWithUnread);
        setError(null);
      } catch (e) {
        console.error('Ошибка загрузки групп:', e);
        setError('Не удалось загрузить группы: ' + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
    groupsPollRef.current = setInterval(fetchGroups, 5000);

    return () => {
      if (groupsPollRef.current) clearInterval(groupsPollRef.current);
    };
  }, [chatId, decorateChatsWithUnread, myId]);

  useEffect(() => {
    if (!chatId) return;
    markChatRead('group', chatId);
    setGroups((prev) => prev.map((group) => (
      String(group.id) === String(chatId)
        ? { ...group, hasUnread: false, unreadCount: 0 }
        : group
    )));
  }, [chatId, markChatRead]);

  useEffect(() => {
    if (!chatId || !myId) return undefined;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await messagesAPI.getList(chatId, 1, 200);
        const list = data.results || data || [];
        const fetchedMessages = list.map((message) => formatMessage(message, myId));

        const mergedMessages = [
          ...fetchedMessages,
          ...pendingMessagesRef.current.filter((pending) => !fetchedMessages.some((message) => (
            message.isOwn
            && message.text === pending.text
            && new Date(message.createdAtRaw).getTime() >= new Date(pending.optimisticCreatedAt).getTime()
          ))),
        ].sort((a, b) => new Date(a.createdAtRaw).getTime() - new Date(b.createdAtRaw).getTime());

        setMessages(mergedMessages);
        const lastMessage = mergedMessages[mergedMessages.length - 1];
        if (lastMessage?.id) {
          chatsAPI.markRead(chatId, lastMessage.id).catch((e) => {
            console.error('Не удалось отметить групповой чат прочитанным:', e);
          });
          markChatRead('group', chatId, lastMessage.id);
          setGroups((prev) => prev.map((group) => (
            String(group.id) === String(chatId)
              ? { ...group, hasUnread: false, unreadCount: 0 }
              : group
          )));
        }
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
  }, [chatId, markChatRead, myId]);

  const loadContactsForCreate = async () => {
    if (contacts.length > 0) return;
    setLoadingContacts(true);
    try {
      const data = await contactsAPI.getList();
      const list = Array.isArray(data) ? data : data.results || [];
      setContacts(list.map((contact) => ({
        id: contact.contact,
        name: `${contact.contact_detail?.first_name || ''} ${contact.contact_detail?.last_name || ''}`.trim()
          || contact.contact_detail?.username
          || 'Без имени',
      })));
    } catch (e) {
      console.error('Ошибка загрузки контактов:', e);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSend = async (text) => {
    if (!text.trim()) return;
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
      isOptimistic: true,
      isOwn: true,
      optimisticCreatedAt,
      created_at: optimisticCreatedAt,
      tag: 'default',
      readStatus: 'sent',
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setPendingMessages((prev) => [...prev, optimisticMessage]);
    registerOutgoingMessage('group', chatId, tempId);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      setIsSending(true);
      const res = await apiRequest('/messages/', {
        method: 'POST',
        body: JSON.stringify({
          chat: parseInt(chatId, 10),
          text,
          message_type: 'default',
        }),
      });

      if (res) {
        setPendingMessages((prev) => prev.filter((pending) => pending.id !== tempId));
        registerOutgoingMessage('group', chatId, res.id);
        setMessages((prev) => prev.map((message) => (
          message.id === tempId ? formatMessage(res, myId) : message
        )));
        setMessageError(null);
      }
    } catch (e) {
      console.error('Ошибка отправки сообщения:', e);
      setMessageError('Не удалось отправить сообщение: ' + e.message);
      setMessages((prev) => prev.map((message) => (
        message.id === tempId ? { ...message, error: true, isOwn: true } : message
      )));
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectGroup = (id) => {
    setLastSelectedGroupId(String(id));
    localStorage.setItem('last_group_chat_id', String(id));
    chatsAPI.markRead(id).catch((e) => {
      console.error('Не удалось отметить групповой чат прочитанным:', e);
    });
    markChatRead('group', id);
    navigate(`/app/groups/${id}`);
  };

  const handleCreateGroup = async () => {
    if (!createForm.title.trim()) return;

    try {
      const newGroup = await chatsAPI.create({
        chat_type: 'group',
        title: createForm.title,
        description: createForm.description,
        participant_ids: createForm.participantIds,
      });
      const formatted = decorateChatsWithUnread('group', [formatGroup(newGroup)], {
        activeChatId: newGroup.id,
        currentUserId: myId,
      })[0];

      setGroups((prev) => [formatted, ...prev]);
      setLastSelectedGroupId(String(newGroup.id));
      localStorage.setItem('last_group_chat_id', String(newGroup.id));
      setShowCreateForm(false);
      setCreateForm({ title: '', description: '', participantIds: [] });
      navigate(`/app/groups/${newGroup.id}`);
    } catch (e) {
      console.error('Ошибка создания группы:', e);
      alert('Не удалось создать группу: ' + e.message);
    }
  };

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
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Введите название группы"
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Описание</label>
              <textarea
                id="description"
                value={createForm.description}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
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
                  {contacts.map((contact) => (
                    <label key={contact.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={createForm.participantIds.includes(contact.id)}
                        onChange={(event) => {
                          const id = contact.id;
                          setCreateForm((prev) => ({
                            ...prev,
                            participantIds: event.target.checked
                              ? [...prev.participantIds, id]
                              : prev.participantIds.filter((participantId) => participantId !== id),
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

  if (chatId) {
    const selectedGroup = groups.find((group) => String(group.id) === chatId);

    return (
      <ChatPageShell
        left={null}
        right={(
          <section className="panel panel--chat-only" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ChatHeader
              title={selectedGroup?.name || 'Групповой чат'}
              subtitle={selectedGroup?.description || ''}
              onBack={() => navigate('/app/groups')}
              compact
            />
            <ChatRoom
              messages={messages}
              loadingMessages={loadingMessages}
              messageError={messageError}
              onSend={handleSend}
              placeholder={`Сообщение в ${selectedGroup?.name || 'группу'}`}
              endRef={endRef}
              composerDisabled={loadingMessages || isSending}
            />
          </section>
        )}
        split={false}
      />
    );
  }

  const filteredGroups = groups.filter((group) => (
    searchQuery.trim() === ''
    || group.name.toLowerCase().includes(searchQuery.toLowerCase())
    || (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ));

  return (
    <ChatPageShell
      left={(
        <section className="panel panel--list panel--list-only">
          <div className="groups-page-header">
            <div>
              <h1 className="groups-page-header__title">Групповые чаты</h1>
              <p className="groups-page-header__subtitle">
                Рабочие группы и проектные обсуждения
              </p>
            </div>
            <button
              type="button"
              className="primary-button groups-page-header__button"
              onClick={() => {
                setShowCreateForm(true);
                loadContactsForCreate();
              }}
            >
              Создать группу
            </button>
          </div>

          <div className="chat-search-wrapper">
            <input
              type="text"
              placeholder="Поиск группы..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="chat-search-input"
            />
          </div>

          <ChatList
            items={filteredGroups}
            selectedId={lastSelectedGroupId}
            onSelect={handleSelectGroup}
            loading={loading}
            error={error}
            emptyNode={(
              <div className="contacts-empty">
                {searchQuery ? (
                  <>Нет групп по запросу «{searchQuery}».<br /></>
                ) : (
                  <>Нет групповых чатов.<br /></>
                )}
                <button
                  className="primary-button contacts-empty__button"
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
      split
    />
  );
}

export default GroupChatsPage;
