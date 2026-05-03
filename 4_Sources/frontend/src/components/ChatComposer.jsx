import { useState } from 'react';

function ChatComposer({ placeholder = 'Введите сообщение', onSend }) {
  const [value, setValue] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setValue('');
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <button className="icon-button" type="button" aria-label="Прикрепить файл">
        📎
      </button>
      <button className="icon-button" type="button" aria-label="Добавить эмодзи">
        😊
      </button>
      <input
        className="composer__input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />
      <button className="primary-button" type="submit">
        Отправить
      </button>
    </form>
  );
}

export default ChatComposer;
