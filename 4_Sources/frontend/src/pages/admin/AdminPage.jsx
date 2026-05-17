import { useEffect, useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { adminActionsFeed, adminMetrics, adminUsers } from '../../data/admin';
import { mainWorkspace } from '../../data/appChats';
import { adminAPI } from '../../api/admin';

const formatUser = (user) => ({
  id: user.id,
  name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
  role: user.role === 'admin' ? 'Администратор' : 'Пользователь',
  status: user.is_active ? 'Активен' : 'Заблокирован',
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

function AdminPage() {
  const [users, setUsers] = useState(adminUsers);
  const [actions, setActions] = useState(adminActionsFeed);
  const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);
  const [emailForm, setEmailForm] = useState({ subject: '', message: '', emails: '' });
  const [emailStatus, setEmailStatus] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadAdminData = async () => {
      const [usersResult, eventsResult] = await Promise.allSettled([
        adminAPI.getUsers(),
        adminAPI.getEvents(),
      ]);

      if (!mounted) return;

      if (usersResult.status === 'fulfilled') {
        const list = Array.isArray(usersResult.value?.results)
          ? usersResult.value.results
          : Array.isArray(usersResult.value)
            ? usersResult.value
            : [];
        if (list.length) setUsers(list.map(formatUser));
      }

      if (eventsResult.status === 'fulfilled') {
        setActions(formatEvents(eventsResult.value));
      }
    };

    loadAdminData();
    return () => { mounted = false; };
  }, []);

  const pushAction = (text) => setActions((prev) => [text, ...prev]);

  const handleAddUser = () => {
    const nextUser = {
      id: Date.now(),
      name: 'Новый пользователь',
      role: 'Пользователь',
      status: 'Ожидает'
    };
    setUsers((prev) => [nextUser, ...prev]);
    pushAction('Добавлен новый пользователь');
  };

  const handleBlock = () => pushAction('Пользователь помечен как заблокированный');
  const handleAssignRole = () => pushAction('Роль пользователя обновлена');
  const handleCreateChat = () => pushAction('Создан новый корпоративный чат');

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
        {adminMetrics.map((metric) => (
          <article className="metric-card" key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-grid">
        <article className="panel">
          <div className="panel__title">Пользователи</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.role}</td>
                    <td>{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel__title">Управление</div>
          <div className="actions-grid actions-grid--wide">
            <button className="primary-button" type="button" onClick={handleAddUser}>
              Добавить пользователя
            </button>
            <button className="secondary-button" type="button" onClick={handleBlock}>
              Заблокировать
            </button>
            <button className="secondary-button" type="button" onClick={handleAssignRole}>
              Назначить роль
            </button>
            <button className="secondary-button" type="button" onClick={handleCreateChat}>
              Создать корпоративный чат
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
