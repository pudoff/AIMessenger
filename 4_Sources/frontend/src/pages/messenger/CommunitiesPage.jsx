import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import SectionHeader from '../../components/SectionHeader';
import { request as apiRequest } from '../../api/client';

// Форматирование сообщества
const formatCommunity = (c) => ({
  id: c.id,
  name: c.title,
  description: c.description || 'Корпоративное сообщество',
  members: c.members_count || 0,
  category: 'Корпоративное',
  highlights: ['Обсуждение проектов', 'Новости компании', 'Командная работа'],
  chat_type: 'corporate',
});

function CommunitiesPage() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const tabFromQuery = queryParams.get('tab');

  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState(() => {
    // Приоритет: communityId из URL > communityId из сохраненного > первый из списка
    return communityId || localStorage.getItem('last_community_id');
  });

  // Загрузка сообществ
  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const data = await apiRequest('/chats/?type=corporate');
        const list = data.results || data || [];
        const formatted = list.map(formatCommunity);
        setCommunities(formatted);
        
        // Устанавливаем selectedCommunityId при первой загрузке
        if (formatted.length > 0) {
          const idToUse = communityId || localStorage.getItem('last_community_id') || String(formatted[0].id);
          setSelectedCommunityId(idToUse);
        }
        setError(null);
      } catch (e) {
        console.error('Ошибка загрузки сообществ:', e);
        setError('Не удалось загрузить сообщества: ' + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, [communityId]);

  const selectedCommunity = communities.find((community) => community.id === selectedCommunityId || String(community.id) === String(selectedCommunityId)) || communities[0];

  // Сохранение выбранного сообщества в localStorage и URL при изменении
  const handleSelectCommunity = (communityId) => {
    setSelectedCommunityId(communityId);
    localStorage.setItem('last_community_id', String(communityId));
    navigate(`/app/community/${communityId}${tabFromQuery ? '?tab=' + tabFromQuery : ''}`, { 
      state: { from: 'communities' } 
    });
  };

  return (
    <div className="workspace workspace--contacts">
      <section className="panel panel--list">
        <SectionHeader title="Сообщества" subtitle="Пространства по интересам, знаниям и рабочим направлениям" />

        <div className="list-stack">
          {loading && <div className="contacts-empty">Загрузка...</div>}
          {error && <div className="contacts-error">{error}</div>}
          {!loading && !error && communities.length === 0 && (
            <div className="contacts-empty contacts-empty--large">
              <h3>Нет сообществ</h3>
              <p className="contacts-empty__text">
                Корпоративные сообщества пока не созданы
              </p>
            </div>
          )}
          {!loading && !error && communities.map((community) => (
            <button
              key={community.id}
              type="button"
              className={`chat-card chat-card--button ${String(community.id) === String(selectedCommunityId) ? 'chat-card--active' : ''}`}
              onClick={() => handleSelectCommunity(community.id)}
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
