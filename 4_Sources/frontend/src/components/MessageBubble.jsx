import Tag from './Tag';

function MessageBubble({ message, currentUserName = 'Вы', className = '' }) {
  if (message.type === 'system') {
    return <div className="system-message">{message.text}</div>;
  }

  const mine = message.isOwn || message.author === currentUserName || message.author === 'Вы';
  const tag = message.tag || message.classification?.label || message.message_type;
  const stateClass = `${message.isOptimistic ? 'message--optimistic' : ''} ${message.error ? 'message--error' : ''}`.trim();
  const readStatus = message.error ? 'error' : message.readStatus;
  const statusText = readStatus === 'read' ? '✓✓' : readStatus === 'sent' ? '✓' : '';
  const statusTitle = readStatus === 'read' ? 'Просмотрено' : readStatus === 'sent' ? 'Отправлено' : 'Ошибка отправки';

  return (
    <article className={`message ${mine ? 'message--mine' : ''} ${stateClass} ${className}`.trim()}>
      <div className={`message__bubble ${mine ? 'message__bubble--mine' : ''}`}>
        <div className="message__meta">
          <strong>{message.author}</strong>
          <span>{message.time}</span>
        </div>
        <Tag value={tag} />
        <p>{message.text}</p>
        {message.attachments?.length > 0 && (
          <div className="message__attachments">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id || attachment.url}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="message__attachment"
              >
                {attachment.original_name || 'attachment'}
              </a>
            ))}
          </div>
        )}
        {readStatus && (
          <span
            className={`message__status message__status--${readStatus}`}
            title={statusTitle}
            aria-label={statusTitle}
          >
            {readStatus === 'error' ? '!' : statusText}
          </span>
        )}
      </div>
    </article>
  );
}

export default MessageBubble;
