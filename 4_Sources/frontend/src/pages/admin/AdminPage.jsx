import { useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { adminActionsFeed, adminMetrics, adminUsers } from '../../data/admin';
import { mainWorkspace } from '../../data/appChats';

function AdminPage() {
  const [users, setUsers] = useState(adminUsers);
  const [actions, setActions] = useState(adminActionsFeed);
  const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);

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
