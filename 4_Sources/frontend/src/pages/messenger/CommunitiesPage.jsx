import { useState, useEffect } from 'react';
import SectionHeader from '../../components/SectionHeader';

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

// Форматирование сообщества
const formatCommunity = (c) => ({
  id: c.id,
  name: c.title,
  description: c.description || 'Корпоративное сообщество',
  members: c.members_count || 0,
  category: 'Корпоративное',
  highlights: ['Обсуждение проектов', 'Новости компании', 'Командная работа'],
});

function CommunitiesPage() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);

  // Загрузка сообществ
  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const data = await apiRequest('/chats/?type=corporate');
        const list = data.results || data || [];
        setCommunities(list.map(formatCommunity));
        if (list.length > 0) setSelectedCommunityId(list[0].id);
        setError(null);
      } catch (e) {
        console.error('Ошибка загрузки сообществ:', e);
        setError('Не удалось загрузить сообщества: ' + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, []);

  const selectedCommunity = communities.find((community) => community.id === selectedCommunityId) || communities[0];

  return (
    <div className="workspace workspace--contacts">
      <section className="panel panel--list">
        <SectionHeader title="Сообщества" subtitle="Пространства по интересам, знаниям и рабочим направлениям" />

        <div className="list-stack">
          {loading && <div className="contacts-empty">Загрузка...</div>}
          {error && <div className="contacts-empty">{error}</div>}
          {!loading && !error && communities.map((community) => (
            <button
              key={community.id}
              type="button"
              className={`chat-card chat-card--button ${community.id === selectedCommunity?.id ? 'chat-card--active' : ''}`}
              onClick={() => setSelectedCommunityId(community.id)}
            >
              <div className="chat-card__top">
                <h3>{community.name}</h3>
                <span className="badge badge--soft">{community.members}</span>
              </div>
              <p>{community.description}</p>
              <small>{community.category}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel--contact-card">
        <SectionHeader
          title={selectedCommunity?.name || 'Выберите сообщество'}
          subtitle={`${selectedCommunity?.category || ''} • ${selectedCommunity?.members || 0} участников`}
        />

        {selectedCommunity && (
          <>
            <div className="community-hero">
              <div className="community-hero__badge">Сообщество</div>
              <p>{selectedCommunity.description}</p>
            </div>

            <div className="community-highlights">
              {selectedCommunity.highlights.map((item) => (
                <article className="info-card" key={item}>
                  <strong>Активность</strong>
                  <span>{item}</span>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default CommunitiesPage;
