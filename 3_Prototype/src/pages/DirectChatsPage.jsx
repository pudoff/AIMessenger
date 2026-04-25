import { useState } from 'react';
import ChatComposer from '../components/ChatComposer';
import MessageBubble from '../components/MessageBubble';
import SectionHeader from '../components/SectionHeader';
import { directChats } from '../data/directChats';

function DirectChatsPage() {
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chatState, setChatState] = useState(directChats);
  const [lastSelectedChatId, setLastSelectedChatId] = useState(directChats[0]?.id ?? null);

  const selectedChat = chatState.find((chat) => chat.id === selectedChatId) || chatState[0];

  const handleSend = (text) => {
    setChatState((prev) =>
      prev.map((chat) =>
        chat.id === selectedChatId
          ? {
              ...chat,
              preview: text,
              messages: [
                ...chat.messages,
                {
                  id: Date.now(),
                  author: 'Вы',
                  time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                  text
                }
              ]
            }
          : chat
      )
    );
  };

  return (
    <div className="workspace workspace--split">
      {!selectedChatId ? (
        <section className="panel panel--list panel--list-only">
          <SectionHeader title="Личные сообщения" subtitle="Личные диалоги с участниками команды" />
          <div className="list-stack">
            {chatState.map((chat) => (
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
                  <span className="status-text">{chat.status}</span>
                </div>
                <p>{chat.preview}</p>
                <small>{chat.position}</small>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel panel--chat panel--chat-only">
          <div className="chat-toolbar chat-toolbar--stack">
            <div className="chat-toolbar__head">
              <button className="secondary-button secondary-button--back" type="button" onClick={() => setSelectedChatId(null)}>
                Назад к списку
              </button>
              <div>
                <strong>{selectedChat.name}</strong>
                <p>{selectedChat.position}</p>
              </div>
            </div>
          </div>
          <div className="messages-feed">
            {selectedChat.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
          <ChatComposer placeholder={`Сообщение для ${selectedChat.name}`} onSend={handleSend} />
        </section>
      )}
    </div>
  );
}

export default DirectChatsPage;
