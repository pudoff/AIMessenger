import { useEffect, useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { adminActionsFeed, adminMetrics } from '../../data/admin';
import { mainWorkspace } from '../../data/appChats';
import { adminAPI } from '../../api/admin';

const formatUser = (user) => ({
  id: user.id,
  name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
  email: user.email || '',
  role: user.role || 'user',
  is_active: user.is_active,
});

const formatEvents = (events) => {
  const registrations = (events.latest_registrations || []).map((user) => (
    `Зарегистрирован пользователь ${user.username}`
  ));
  const chats = (events.created_chats || []).map((chat) => (
    `Создан чат «${chat.title}»`
  ));
  const counters = [
    `Сообщений за сутки: ${events.messages_last_24h ?? 0}`,
    `Активных пользователей за сутки: ${events.active_users_last_24h ?? 0}`,
  ];
  return [...counters, ...registrations, ...chats];
};

const formatChat = (chat) => ({
  id: chat.id,
  title: chat.title,
  created_at: chat.created_at,
  members_count: chat.members_count || 0,
});

function AdminPage() {
  const [users, setUsers] = useState([]);
  const [actions, setActions] = useState(adminActionsFeed);
  const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);
  const [emailForm, setEmailForm] = useState({ subject: '', message: '', emails: '' });
  const [emailStatus, setEmailStatus] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [corporateChatName, setCorporateChatName] = useState('');
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Динамический расчет метрик на основе загруженных данных
  const calculatedMetrics = [
    { id: 'total-users', label: 'Всего пользователей', value: users.length },
    { id: 'active-users', label: 'Активные пользователи', value: users.filter(u => u.is_active).length },
    { id: 'total-chats', label: 'Корпоративные чаты', value: chats.length },
    {
      id: 'total-members',
      label: 'Участников в чатах',
      value: chats.reduce((sum, chat) => sum + (chat.members_count || 0), 0)
    },
  ];

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(user =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  useEffect(() => {
    let mounted = true;

    const loadAdminData = async () => {
      try {
        const [usersResult, eventsResult, chatsResult] = await Promise.allSettled([
          adminAPI.getUsers(),
          adminAPI.getEvents(),
          adminAPI.getCorporateChats(),
        ]);

        if (!mounted) return;

        if (usersResult.status === 'fulfilled') {
          const list = Array.isArray(usersResult.value?.results)
            ? usersResult.value.results
            : Array.isArray(usersResult.value)
              ? usersResult.value
              : [];
          if (list.length) {
            const formattedUsers = list.map(formatUser);
            setUsers(formattedUsers);
            setFilteredUsers(formattedUsers);
          }
        }

        if (eventsResult.status === 'fulfilled') {
          setActions(formatEvents(eventsResult.value));
        }

        if (chatsResult.status === 'fulfilled') {
          const chatList = Array.isArray(chatsResult.value?.results)
            ? chatsResult.value.results
            : Array.isArray(chatsResult.value)
              ? chatsResult.value
              : [];
          if (chatList.length) {
            setChats(chatList.map(formatChat));
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки данных админки:', err);
        setError('Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
    return () => { mounted = false; };
  }, []);

  const pushAction = (text) => setActions((prev) => [text, ...prev]);

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      await adminAPI.updateUser(userId, { is_active: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
      pushAction(`Пользователь ${newStatus ? 'разблокирован' : 'заблокирован'}`);
    } catch (err) {
      console.error('Ошибка изменения статуса:', err);
      alert('Не удалось изменить статус пользователя');
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      await adminAPI.updateUser(userId, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      pushAction(`Роль пользователя изменена на ${newRole === 'admin' ? 'администратор' : 'пользователь'}`);
    } catch (err) {
      console.error('Ошибка изменения роли:', err);
      alert('Не удалось изменить роль пользователя');
    }
  };

  const handleCreateCorporateChat = async () => {
    if (!corporateChatName.trim()) {
      alert('Введите название чата');
      return;
    }
    try {
      await adminAPI.createCorporateChat({
        title: corporateChatName.trim(),
        chat_type: 'corporate',
      });
      pushAction(`Создан корпоративный чат «${corporateChatName.trim()}»`);
      setCorporateChatName('');
      alert('Корпоративный чат создан');
    } catch (err) {
      console.error('Ошибка создания чата:', err);
      alert('Не удалось создать чат');
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setEmailStatus(null);
    setIsSendingEmail(true);

    const emails = emailForm.emails
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const result = await adminAPI.sendBroadcast({
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim(),
        ...(emails.length ? { emails } : {}),
      });
      setEmailStatus({ type: 'success', text: `Письмо отправлено. Получателей: ${result.recipients?.length || 0}` });
      setEmailForm({ subject: '', message: '', emails: '' });
      pushAction('Выполнена e-mail рассылка');
    } catch (error) {
      setEmailStatus({ type: 'error', text: error.message || 'Не удалось отправить письмо' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) return <div className="loading">Загрузка данных администратора...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-page">
      <SectionHeader title="Панель администратора" subtitle="Мониторинг пользователей, чатов и системных действий" />

      <section className="panel admin-workspace-panel">
        <div className="panel__title panel__title--between">
          <span>Рабочее пространство проекта</span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setIsWorkspaceVisible((prev) => !prev)}
          >
            {isWorkspaceVisible ? 'Скрыть' : 'Показать'}
          </button>
        </div>

        {isWorkspaceVisible && (
          <div className="workspace-summary-card">
            <div>
              <strong>{mainWorkspace.title}</strong>
              <p>{mainWorkspace.description}</p>
            </div>
            <div className="avatars">
              {mainWorkspace.participants.map((item) => (
                <div key={item.id} className="avatar" title={item.name}>
                  {item.initials}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="metrics-grid">
        {calculatedMetrics.map((metric) => (
          <article className="metric-card" key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-grid">
        <article className="panel">
          <div className="panel__title panel__title--between">
            <span>Пользователи</span>
            <input
              type="text"
              placeholder="Поиск по имени или email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      {searchQuery ? 'Пользователи не найдены' : 'Список пользователей пуст'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeUserRole(user.id, e.target.value)}
                          className="role-select"
                        >
                          <option value="user">Пользователь</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </td>
                      <td>{user.is_active ? 'Активен' : 'Заблокирован'}</td>
                      <td>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                        >
                          {user.is_active ? 'Заблокировать' : 'Разблокировать'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel__title">Корпоративные чаты</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Участников</th>
                  <th>Дата создания</th>
                </tr>
              </thead>
              <tbody>
                {chats.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                      Корпоративные чаты отсутствуют
                    </td>
                  </tr>
                ) : (
                  chats.map((chat) => (
                    <tr key={chat.id}>
                      <td>{chat.title}</td>
                      <td>{chat.members_count}</td>
                      <td>{new Date(chat.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel__title">Создать корпоративный чат</div>
          <div className="form-stack">
            <div className="form-group">
              <label htmlFor="corporate-chat-name">Название чата</label>
              <input
                id="corporate-chat-name"
                type="text"
                value={corporateChatName}
                onChange={(e) => setCorporateChatName(e.target.value)}
                placeholder="Например: Общие объявления"
              />
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={handleCreateCorporateChat}
              disabled={!corporateChatName.trim()}
            >
              Создать чат
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel__title">E-mail рассылка</div>
          <form className="form-stack" onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label htmlFor="email-subject">Тема письма</label>
              <input
                id="email-subject"
                value={emailForm.subject}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Например: Итоги недели"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email-message">Текст письма</label>
              <textarea
                id="email-message"
                value={emailForm.message}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Введите сообщение для пользователей"
                rows={5}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email-recipients">Получатели</label>
              <textarea
                id="email-recipients"
                value={emailForm.emails}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, emails: event.target.value }))}
                placeholder="Оставьте пустым, чтобы отправить всем активным пользователям с e-mail"
                rows={3}
              />
            </div>
            {emailStatus && (
              <div className={emailStatus.type === 'success' ? 'form-success' : 'form-error'}>
                {emailStatus.text}
              </div>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={isSendingEmail || !emailForm.subject.trim() || !emailForm.message.trim()}
            >
              {isSendingEmail ? 'Отправка...' : 'Отправить рассылку'}
            </button>
          </form>
        </article>

        <article className="panel">
          <div className="panel__title">Последние действия</div>
          <div className="activity-feed">
            {actions.map((action, index) => (
              <div className="activity-item" key={`${action}-${index}`}>
                {action}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default AdminPage;
