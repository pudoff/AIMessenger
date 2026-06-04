import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import Tag from './Tag';
import { resolveMediaUrl } from '../utils/media';

const IMAGE_EXTENSION_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i;

function getAttachmentUrl(attachment) {
  return resolveMediaUrl(attachment.preview_url || attachment.url || attachment.file_url || attachment.file || '');
}

function getAttachmentName(attachment) {
  return attachment.original_name || attachment.name || 'Вложение';
}

function isImageAttachment(attachment) {
  const contentType = (attachment.content_type || attachment.type || '').toLowerCase();
  const url = getAttachmentUrl(attachment);
  const name = getAttachmentName(attachment);

  return contentType.startsWith('image/') || IMAGE_EXTENSION_RE.test(url) || IMAGE_EXTENSION_RE.test(name);
}

function AttachmentPreview({ attachment }) {
  const url = getAttachmentUrl(attachment);
  const name = getAttachmentName(attachment);

  if (!url) {
    return <span className="message__attachment">{name}</span>;
  }

  if (!isImageAttachment(attachment)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="message__attachment">
        {name}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="message__image-attachment"
      aria-label={`Открыть изображение ${name}`}
    >
      <span className="message__image-thumb">
        <img src={url} alt={name} loading="lazy" />
      </span>
      <span className="message__image-caption">{name}</span>
      <span className="message__image-popover" aria-hidden="true">
        <img src={url} alt="" loading="lazy" />
      </span>
    </a>
  );
}

function MessageBubble({ message, currentUserName = 'Вы', className = '', onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.text || '');

  useEffect(() => {
    if (!isEditing) {
      setDraft(message.text || '');
    }
  }, [message.text, isEditing]);

  if (message.type === 'system') {
    return <div className="system-message">{message.text}</div>;
  }

  const mine = message.isOwn || message.author === currentUserName || message.author === 'Вы' || message.author === 'Р’С‹';
  const tag = message.tag || message.classification?.label || message.message_type;
  const stateClass = `${message.isOptimistic ? 'message--optimistic' : ''} ${message.error ? 'message--error' : ''}`.trim();
  const readStatus = message.error ? 'error' : message.readStatus;
  const statusText = readStatus === 'read' ? '✓✓' : readStatus === 'sent' ? '✓' : '';
  const statusTitle = readStatus === 'read' ? 'Просмотрено' : readStatus === 'sent' ? 'Отправлено' : 'Ошибка отправки';
  const initials = (message.author || currentUserName || '??').slice(0, 2).toUpperCase();
  const canManage = mine && !message.isOptimistic && !message.error && !String(message.id).startsWith('temp-');

  const submitEdit = (event) => {
    event.preventDefault();
    const nextText = draft.trim();
    if (!nextText || nextText === (message.text || '').trim()) {
      setIsEditing(false);
      setDraft(message.text || '');
      return;
    }
    onEdit?.(message.id, nextText);
    setIsEditing(false);
  };

  return (
    <article className={`message ${mine ? 'message--mine' : ''} ${stateClass} ${className}`.trim()}>
      {!mine && (
        <Avatar
          src={message.sender_avatar_url || message.avatar_url}
          initials={initials}
          title={message.author}
          className="avatar--circle message__avatar"
        />
      )}
      <div className={`message__bubble ${mine ? 'message__bubble--mine' : ''}`}>
        <div className="message__meta">
          <strong>{message.author}</strong>
          <span>{message.time}</span>
        </div>
        <Tag value={tag} />
        {isEditing ? (
          <form className="message__edit-form" onSubmit={submitEdit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              autoFocus
            />
            <span className="message__edit-actions">
              <button type="button" onClick={() => { setIsEditing(false); setDraft(message.text || ''); }}>Отмена</button>
              <button type="submit" disabled={!draft.trim()}>Сохранить</button>
            </span>
          </form>
        ) : (
          <p>{message.text}</p>
        )}
        {message.attachments?.length > 0 && (
          <div className="message__attachments">
            {message.attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id || getAttachmentUrl(attachment) || getAttachmentName(attachment)}
                attachment={attachment}
              />
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
        {canManage && !isEditing && (
          <div className="message__actions">
            <button type="button" onClick={() => setIsEditing(true)}>Редактировать</button>
            <button type="button" onClick={() => onDelete?.(message.id)}>Удалить</button>
          </div>
        )}
      </div>
      {mine && (
        <Avatar
          src={message.sender_avatar_url || message.avatar_url}
          initials={initials}
          title={message.author || currentUserName}
          className="avatar--circle message__avatar"
        />
      )}
    </article>
  );
}

export default MessageBubble;
