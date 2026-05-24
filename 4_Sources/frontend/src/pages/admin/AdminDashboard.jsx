import { useEffect, useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { mainWorkspace } from '../../data/appChats';
import { adminAPI } from '../../api/admin';

function AdminDashboard() {
  const [metrics, setMetrics] = useState([]);
  const [actions, setActions] = useState([]);
  const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadDashboardData = async () => {
      try {
        // Загружаем события и общую статистику параллельно
        const [events, usersData, chatsData] = await Promise.all([
          adminAPI.getEvents(),
          adminAPI.getUsersStats(),
          adminAPI.getChatsStats()
        ]);

        if (!mounted) return;

        // Формируем метрики из данных бэкенда
        const backendMetrics = [
          { id: 'users', label: 'Пользователи', value: usersData.total ?? 0 },
          { id: 'active', label: 'Активные чаты', value: chatsData.active ?? 0 },
          { id: 'groups', label: 'Корпоративные чаты', value: chatsData.corporate ?? 0 },
          { id: 'messages', label: 'Сообщения за сутки', value: events.messages_last_24h ?? 0 }
        ];
        setMetrics(backendMetrics);

        // Формируем ленту действий
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
        setActions([...counters, ...registrations, ...chats]);
      } catch (err) {
        console.error('Ошибка загрузки данных дашборда:', err);
        setError('Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="loading">Загрузка...</div>;
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
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel__title">Последние действия</div>
        <div className="activity-feed">
          {actions.map((action, index) => (
            <div className="activity-item" key={`${action}-${index}`}>
              {action}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;