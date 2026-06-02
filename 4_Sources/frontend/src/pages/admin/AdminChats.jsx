import { useEffect, useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { adminAPI } from '../../api/admin';

const formatChat = (chat) => ({
  id: chat.id,
  title: chat.title,
  created_at: chat.created_at,
  members_count: chat.members_count || 0,
});

function AdminChats() {
  const [chats, setChats] = useState([]);
  const [corporateChatName, setCorporateChatName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadChats = async () => {
      try {
        const chatList = await adminAPI.getCorporateChats();

        if (!mounted) return;

        if (chatList.length) {
          setChats(chatList.map(formatChat));
        } else {
          // Список пуст, но не ошибка
          setChats([]);
        }
        setError('');
      } catch (err) {
        console.error('Ошибка загрузки чатов:', err);
        setError('Не удалось загрузить чаты');
      } finally {
        setLoading(false);
      }
    };

    loadChats();
    return () => { mounted = false; };
  }, []);

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
      setCorporateChatName('');
      alert('Корпоративный чат создан');
      // Перезагружаем список чатов
      const chatList = await adminAPI.getCorporateChats();
      if (chatList.length) {
        setChats(chatList.map(formatChat));
      } else {
        setChats([]);
      }
    } catch (err) {
      console.error('Ошибка создания чата:', err);
      alert('Не удалось создать чат');
    }
  };

  return (
    <div className="admin-page">
      <SectionHeader title="Корпоративные чаты" subtitle="Просмотр и создание корпоративных чатов" />

      <section className="admin-grid">
        <article className="panel">
          <div className="panel__title">Список корпоративных чатов</div>
          <div className="table-wrap">
            {loading ? (
              <div className="contacts-empty">Загрузка чатов...</div>
            ) : error ? (
              <div className="contacts-error">{error}</div>
            ) : (
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
                      <td colSpan="3" className="data-table__empty-cell">
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
            )}
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
      </section>
    </div>
  );
}

export default AdminChats;