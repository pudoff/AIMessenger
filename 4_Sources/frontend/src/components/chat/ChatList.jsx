import React from 'react';

export default function ChatList({ items = [], selectedId, onSelect, loading, error, emptyNode, topNode }) {
  return (
    <section className="panel panel--list panel--list-only">
      {topNode}
      {loading && <div className="contacts-empty">Загрузка...</div>}
      {error && <div className="contacts-error">{error}</div>}
      {!loading && items.length === 0 && (emptyNode || (
        <div className="contacts-empty">Нет чатов</div>
      ))}

      <div className="list-stack">
        {items.map((chat) => (
          <button
            className={`chat-card chat-card--button ${String(chat.id) === String(selectedId) ? 'chat-card--active' : ''}`}
            key={chat.id}
            type="button"
            onClick={() => onSelect?.(chat.id)}
          >
            <div className="chat-card__top">
              <h3>{chat.name}</h3>
              {chat.badge != null && <span className="badge">{chat.badge}</span>}
            </div>
            <p>{chat.preview}</p>
            <small>{chat.position || chat.description || ''}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
