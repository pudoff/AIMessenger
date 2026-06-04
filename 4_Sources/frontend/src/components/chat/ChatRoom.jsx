import React, { useEffect, useRef } from 'react';
import MessageBubble from '../../components/MessageBubble';
import ChatComposer from '../../components/ChatComposer';

const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function getDateKey(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDivider(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (getDateKey(value) === getDateKey(today)) {
    return 'Сегодня';
  }

  if (getDateKey(value) === getDateKey(yesterday)) {
    return 'Вчера';
  }

  return DATE_FORMATTER.format(date);
}

export default function ChatRoom({
  messages = [],
  loadingMessages = false,
  messageError = null,
  onSend,
  placeholder,
  endRef,
  composerDisabled = false,
  searchNode = null,
  focusedMessageId = null,
  onEditMessage,
  onDeleteMessage,
}) {
  const messageRefs = useRef({});

  useEffect(() => {
    if (!focusedMessageId) {
      return;
    }
    messageRefs.current[String(focusedMessageId)]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [focusedMessageId]);

  return (
    <section className="panel panel--chat panel--chat-only" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
      <div className="messages-feed" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {searchNode}
        {messageError && <div className="contacts-error">{messageError}</div>}

        {messages.map((msg, index) => {
          const currentDateKey = getDateKey(msg.createdAtRaw || msg.created_at || msg.optimisticCreatedAt);
          const previous = messages[index - 1];
          const previousDateKey = previous ? getDateKey(previous.createdAtRaw || previous.created_at || previous.optimisticCreatedAt) : '';
          const showDateDivider = currentDateKey && currentDateKey !== previousDateKey;

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className="message-date-divider">{formatDateDivider(msg.createdAtRaw || msg.created_at || msg.optimisticCreatedAt)}</div>
              )}
              <div
                ref={(node) => {
                  if (node) {
                    messageRefs.current[String(msg.id)] = node;
                  } else {
                    delete messageRefs.current[String(msg.id)];
                  }
                }}
                className={String(msg.id) === String(focusedMessageId) ? 'message-focus-anchor message-focus-anchor--active' : 'message-focus-anchor'}
              >
                <MessageBubble
                  message={msg}
                  className={msg.isOptimistic ? 'message--optimistic' : msg.error ? 'message--error' : ''}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                />
              </div>
            </React.Fragment>
          );
        })}

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
