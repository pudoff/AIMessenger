import { useState } from 'react';
import ChatComposer from '../../components/ChatComposer';
import MessageBubble from '../../components/MessageBubble';
import { assistantQuickActions } from '../../data/assistant';
import { mainChats, mainMessages, mainWorkspace } from '../../data/appChats';
import ChatPageShell from '../../components/chat/ChatPageShell';
import ChatList from '../../components/chat/ChatList';
import ChatRoom from '../../components/chat/ChatRoom';

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
    <>
      <ChatPageShell
        left={(
          <>
            <div className="search-box">
              <input
                type="search"
                className="search-box__input"
                placeholder="Поиск по чатам"
                aria-label="Поиск по чатам"
              />
            </div>
            <ChatList
              items={mainChats}
              selectedId={lastSelectedChatId}
              onSelect={(id) => { setSelectedChatId(id); setLastSelectedChatId(id); }}
            />
          </>
        )}
        right={(
          selectedChatId ? (
            <>
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

              <ChatRoom messages={messages} onSend={handleSend} placeholder={`Напишите сообщение в чат «${selectedChat.name}»`} />
            </>
          ) : null
        )}
        split={true}
      />

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
    </>
  );
}

export default MessengerPage;
