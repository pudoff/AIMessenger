import { useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import { communities } from '../data/communities';

function CommunitiesPage() {
  const [selectedCommunityId, setSelectedCommunityId] = useState(communities[0]?.id ?? null);
  const selectedCommunity =
    communities.find((community) => community.id === selectedCommunityId) || communities[0];

  return (
    <div className="workspace workspace--contacts">
      <section className="panel panel--list">
        <SectionHeader title="Сообщества" subtitle="Пространства по интересам, знаниям и рабочим направлениям" />

        <div className="list-stack">
          {communities.map((community) => (
            <button
              key={community.id}
              type="button"
              className={`chat-card chat-card--button ${community.id === selectedCommunity.id ? 'chat-card--active' : ''}`}
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
          title={selectedCommunity.name}
          subtitle={`${selectedCommunity.category} • ${selectedCommunity.members} участников`}
        />

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
      </section>
    </div>
  );
}

export default CommunitiesPage;
