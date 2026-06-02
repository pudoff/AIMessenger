import React from 'react';
import Avatar from '../Avatar';

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
        {items.map((chat) => {
          const unreadCount = Number(chat.unreadCount || 0);
          const hasUnread = unreadCount > 0 || chat.hasUnread;

          return (
            <button
              className={`chat-card chat-card--button ${String(chat.id) === String(selectedId) ? 'chat-card--active' : ''} ${hasUnread ? 'chat-card--unread' : ''}`}
              key={chat.id}
              type="button"
              onClick={() => onSelect?.(chat.id)}
            >
              <div className="chat-card__top">
                <span className="chat-card__identity">
                  <Avatar
                    src={chat.avatar_url}
                    initials={chat.initials}
                    title={chat.name}
                    className="avatar--circle"
                    clickable={false}
                  />
                  <h3>{chat.name}</h3>
                </span>
                {chat.badge != null && <span className="badge">{chat.badge}</span>}
              </div>
              <p>{chat.preview}</p>
              <small>{chat.position || chat.description || ''}</small>
              {unreadCount > 0 && (
                <span className="chat-card__unread-count" aria-label={`Непрочитанных сообщений: ${unreadCount}`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
