import { useState } from 'react';
import ChatComposer from '../../components/ChatComposer';
import MessageBubble from '../../components/MessageBubble';
import { assistantQuickActions } from '../../data/assistant';
import { mainChats, mainMessages, mainWorkspace } from '../../data/appChats';

function MessengerPage() {
  const [messages, setMessages] = useState(mainMessages);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [lastSelectedChatId, setLastSelectedChatId] = useState(mainChats[0]?.id ?? null);

  const selectedChat = mainChats.find((chat) => chat.id === selectedChatId) || mainChats[0];

  const handleSend = (text) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: 'message',
        tag: 'Обычное',
        author: 'Вы',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        text
      }
    ]);
  };

  return (
    <div className="workspace workspace--messenger">
      {!selectedChatId ? (
        <section className="panel panel--list panel--list-only">
        <div className="search-box">
          <input
            type="search"
            className="search-box__input"
            placeholder="Поиск по чатам"
            aria-label="Поиск по чатам"
          />
        </div>
        
          <div className="list-stack">
            {mainChats.map((chat) => (
              <button
                className={`chat-card chat-card--button ${chat.id === lastSelectedChatId ? 'chat-card--active' : ''}`}
                key={chat.id}
                type="button"
                onClick={() => {
                  setSelectedChatId(chat.id);
                  setLastSelectedChatId(chat.id);
                }}
              >
                <div className="chat-card__top">
                  <h3>{chat.name}</h3>
                  {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
                </div>
                <p>{chat.description}</p>
                <small>{chat.meta}</small>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel panel--chat panel--chat-only">
          <div className="chat-toolbar">
            <div className="chat-toolbar__head">
              <button className="secondary-button secondary-button--back" type="button" onClick={() => setSelectedChatId(null)}>
                Назад к чатам
              </button>
              <div>
                <strong>{selectedChat.name}</strong>
                <p>{selectedChat.description}</p>
              </div>
            </div>

            <div className="avatars">
              {mainWorkspace.participants.map((item) => (
                <div key={item.id} className="avatar" title={item.name}>
                  {item.initials}
                </div>
              ))}
            </div>
          </div>

          <div className="messages-feed">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>

          <ChatComposer placeholder={`Напишите сообщение в чат «${selectedChat.name}»`} onSend={handleSend} />
        </section>
      )}

      <aside className={`floating-insights ${isInsightsOpen ? 'floating-insights--open' : ''}`}>
        {isInsightsOpen ? (
          <div className="panel panel--insights panel--insights-floating">
            <div className="panel__title panel__title--between">
              <span>AI-ассистент и аналитика</span>
              <button
                className="icon-button"
                type="button"
                onClick={() => setIsInsightsOpen(false)}
                aria-label="Свернуть AI-панель"
              >
                ×
              </button>
            </div>
            <div className="insight-card">
              <strong>Текущий контекст</strong>
              <p>В обсуждении выделены маршруты, авторизация и админ-панель.</p>
            </div>
            <div className="insight-card">
              <strong>Теги в беседе</strong>
              <div className="tag-row">
                <span className="tag tag--question">Вопрос</span>
                <span className="tag tag--task">Задача</span>
                <span className="tag tag--default">Обычное</span>
              </div>
            </div>
            <div className="panel__title panel__title--small">Быстрые действия</div>
            <div className="actions-grid">
              {assistantQuickActions.map((action) => (
                <button className="secondary-button secondary-button--soft" key={action} type="button">
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            className="ai-fab"
            type="button"
            onClick={() => setIsInsightsOpen(true)}
            aria-label="Открыть AI-ассистента"
          >
            <span className="ai-fab__icon">AI</span>
            <span className="ai-fab__label">Ассистент</span>
          </button>
        )}
      </aside>
    </div>
  );
}

export default MessengerPage;
