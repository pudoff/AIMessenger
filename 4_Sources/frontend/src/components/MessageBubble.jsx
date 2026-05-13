import Tag from './Tag';

function MessageBubble({ message, currentUserName = 'Вы' }) {
  if (message.type === 'system') {
    return <div className="system-message">{message.text}</div>;
  }

  const mine = message.isOwn || message.author === currentUserName || message.author === 'Вы';

  return (
    <article className={`message ${mine ? 'message--mine' : ''}`}>
      <div className={`message__bubble ${mine ? 'message__bubble--mine' : ''}`}>
        <div className="message__meta">
          <strong>{message.author}</strong>
          <span>{message.time}</span>
        </div>
        <Tag value={message.tag} />
        <p>{message.text}</p>
      </div>
    </article>
  );
}

export default MessageBubble;
