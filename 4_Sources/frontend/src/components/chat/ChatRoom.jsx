import React from 'react';
import MessageBubble from '../../components/MessageBubble';
import ChatComposer from '../../components/ChatComposer';

export default function ChatRoom({
  messages = [],
  loadingMessages = false,
  messageError = null,
  onSend,
  placeholder,
  endRef,
  composerDisabled = false,
}) {
  return (
    <section className="panel panel--chat panel--chat-only">
      <div className="messages-feed">
        {loadingMessages && messages.length === 0 && (
          <div className="contacts-empty">Загрузка сообщений...</div>
        )}
        {messageError && <div className="contacts-error">{messageError}</div>}
        {!loadingMessages && messages.length === 0 && (
          <div className="contacts-empty" style={{ padding: '40px' }}>
            Начните диалог — напишите первое сообщение
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            className={msg.isOptimistic ? 'message--optimistic' : msg.error ? 'message--error' : ''}
          />
        ))}
        <div ref={endRef} />
      </div>

      <ChatComposer
        placeholder={placeholder}
        onSend={onSend}
        disabled={composerDisabled}
      />
    </section>
  );
}
