import { useEffect, useRef, useState } from 'react';

const EMOJIS = ['😀', '😊', '😂', '😍', '🤔', '👍', '🙏', '👏', '🔥', '✅', '🎯', '📌', '💡', '🚀', '❤️', '☕'];

function ChatComposer({ placeholder = 'Введите сообщение', onSend, disabled = false }) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState([]);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!composerRef.current?.contains(event.target)) {
        setIsEmojiOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (event) => {
    if (event) event.preventDefault();

    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || disabled) return;

    onSend(trimmed, files);
    setValue('');
    setFiles([]);
    setIsEmojiOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`;

    setValue(nextValue);
    requestAnimationFrame(() => {
      textarea?.focus();
      if (textarea) {
        const cursorPosition = start + emoji.length;
        textarea.selectionStart = cursorPosition;
        textarea.selectionEnd = cursorPosition;
      }
    });
  };

  const isSubmitDisabled = disabled || (!value.trim() && files.length === 0);

  return (
    <form className="composer composer--stack" onSubmit={handleSubmit} ref={composerRef}>
      <input
        ref={fileInputRef}
        className="composer__file-input"
        type="file"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files || []))}
      />

      {files.length > 0 && (
        <div className="composer__attachments">
          {files.map((file) => (
            <span className="composer__attachment" key={`${file.name}-${file.size}`}>
              {file.name}
              <button type="button" onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}>
                x
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="composer__row">
        <button
          className="icon-button"
          type="button"
          aria-label="Прикрепить файл"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>

        <div className="composer__emoji-wrap">
          <button
            className={`icon-button ${isEmojiOpen ? 'icon-button--active' : ''}`}
            type="button"
            aria-label="Добавить эмодзи"
            aria-expanded={isEmojiOpen}
            disabled={disabled}
            onClick={() => setIsEmojiOpen((prev) => !prev)}
          >
            😊
          </button>

          {isEmojiOpen && (
            <div className="emoji-picker" role="menu" aria-label="Выбор эмодзи">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className="emoji-picker__item" onClick={() => insertEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="composer__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
        />

        <button className="primary-button composer__submit" type="submit" disabled={isSubmitDisabled}>
          Отправить
        </button>
      </div>
    </form>
  );
}

export default ChatComposer;
