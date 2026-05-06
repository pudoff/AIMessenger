import { useState } from 'react';
import { stories } from '../data/stories';

function StoriesBar() {
  const [activeStory, setActiveStory] = useState(null);

  return (
    <>
      <section className="stories-strip panel">
        <div className="stories-strip__head">
          <strong>Истории</strong>
          <span>Быстрые обновления от контактов</span>
        </div>

        <div className="stories-strip__list">
          {stories.map((story) => (
            <button
              key={story.id}
              type="button"
              className="story-pill"
              onClick={() => setActiveStory(story)}
            >
              <span className="story-pill__avatar">{story.initials}</span>
              <span className="story-pill__name">{story.name}</span>
            </button>
          ))}
        </div>
      </section>

      {activeStory && (
        <div className="story-viewer" role="dialog" aria-modal="true" onClick={() => setActiveStory(null)}>
          <div className="story-viewer__card" onClick={(event) => event.stopPropagation()}>
            <div className="story-viewer__top">
              <div>
                <strong>{activeStory.fullName}</strong>
                <span>{activeStory.role}</span>
              </div>
              <button type="button" className="icon-button" onClick={() => setActiveStory(null)} aria-label="Закрыть историю">
                ×
              </button>
            </div>
            <img src={activeStory.image} alt={`История пользователя ${activeStory.fullName}`} />
          </div>
        </div>
      )}
    </>
  );
}

export default StoriesBar;
