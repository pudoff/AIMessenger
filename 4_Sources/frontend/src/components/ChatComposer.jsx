import { useState, useRef, useEffect } from 'react';

function ChatComposer({ placeholder = 'Введите сообщение', onSend, disabled = false }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  // Авто-ресайз textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = (event) => {
    if (event) {
      event.preventDefault();
    }

    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }

    onSend(trimmed);
    setValue('');
    // Сброс высоты после отправки
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
    // Shift+Enter позволяет добавить перенос строки (стандартное поведение textarea)
  };

  const handleChange = (event) => {
    setValue(event.target.value);
  };

  const isDisabled = !value.trim();

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <button
        className="icon-button"
        type="button"
        aria-label="Прикрепить файл"
      >
        📎
      </button>
      <button
        className="icon-button"
        type="button"
        aria-label="Добавить эмодзи"
      >
        😊
      </button>
      <textarea
        ref={textareaRef}
        className="composer__input"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
      />
      <button
        className="primary-button composer__submit"
        type="submit"
        disabled={isDisabled}
      >
        Отправить
      </button>
    </form>
  );
}

export default ChatComposer;