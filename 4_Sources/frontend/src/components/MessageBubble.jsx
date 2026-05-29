import Tag from './Tag';

function MessageBubble({ message, currentUserName = 'Вы', className = '' }) {
  if (message.type === 'system') {
    return <div className="system-message">{message.text}</div>;
  }

  const mine = message.isOwn || message.author === currentUserName || message.author === 'Вы';
  const tag = message.tag || message.classification?.label || message.message_type;
  const stateClass = `${message.isOptimistic ? 'message--optimistic' : ''} ${message.error ? 'message--error' : ''}`.trim();

  return (
    <article className={`message ${mine ? 'message--mine' : ''} ${stateClass} ${className}`.trim()}>
      <div className={`message__bubble ${mine ? 'message__bubble--mine' : ''}`}>
        <div className="message__meta">
          <strong>{message.author}</strong>
          <span>{message.time}</span>
        </div>
        <Tag value={tag} />
        <p>{message.text}</p>
      </div>
    </article>
  );
}

export default MessageBubble;
