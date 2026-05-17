import React from 'react';

export default function ChatHeader({ title, subtitle, onBack, backLabel = 'Назад к списку', avatars }) {
  return (
    <div className="chat-toolbar">
      <div className="chat-toolbar__head">
        {onBack && (
          <button className="secondary-button secondary-button--back" type="button" onClick={onBack}>
            {backLabel}
          </button>
        )}
        <div>
          <strong>{title}</strong>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      {avatars && <div className="avatars">{avatars}</div>}
    </div>
  );
}
