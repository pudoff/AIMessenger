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
        {messageError && <div className="contacts-error">{messageError}</div>}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            className={msg.isOptimistic ? 'message--optimistic' : msg.error ? 'message--error' : ''}
          />
        ))}

        {!messageError && messages.length === 0 && (
          <div className="contacts-empty contacts-empty--chat">
            Начните диалог — напишите первое сообщение
          </div>
        )}

        {loadingMessages && messages.length === 0 && !messageError && (
          <div className="contacts-empty">Загрузка сообщений...</div>
        )}

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