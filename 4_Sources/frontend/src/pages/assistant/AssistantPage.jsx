import { useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { assistantContext, assistantDefaultCards, assistantQuickActions } from '../../data/assistant';

function buildAssistantAnswer(question) {
  const normalized = question.toLowerCase();

  if (normalized.includes('кто отвечает')) {
    return {
      title: 'Ответственный',
      text: 'За текущий блок интерфейса и маршрутов отвечает проектная команда фронтенда. По демо-сценарию ключевой ответственный — Елена Ковалева.'
    };
  }

  if (normalized.includes('задачи')) {
    return {
      title: 'Список задач',
      text: 'Текущие задачи: завершить авторизацию, собрать страницы чатов, подготовить админ-панель и оформить AI-ассистента.'
    };
  }

  if (normalized.includes('итоги') || normalized.includes('резюме')) {
    return {
      title: 'Краткое резюме',
      text: 'Команда обсуждает MVP мессенджера, защиту маршрутов, русифицированный интерфейс и отдельный кабинет администратора.'
    };
  }

  return {
    title: 'Общий ответ',
    text: 'Я обработал запрос и могу помочь с выделением ответственных, задач и краткого резюме текущего обсуждения.'
  };
}

function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [cards, setCards] = useState(assistantDefaultCards);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);

    // Имитация задержки запроса к API
    setTimeout(() => {
      try {
        const answer = buildAssistantAnswer(trimmed);

        setCards((prev) => [
          {
            id: Date.now(),
            title: `Запрос: ${trimmed}`,
            text: answer.text
          },
          ...prev
        ]);

        setQuestion('');
      } catch (err) {
        setError('Не удалось получить ответ от ассистента');
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  const handleQuickAction = (action) => {
    setLoading(true);
    setError(null);

    setTimeout(() => {
      try {
        setCards((prev) => [
          {
            id: Date.now(),
            title: action,
            text: buildAssistantAnswer(action).text
          },
          ...prev
        ]);
      } catch (err) {
        setError('Не удалось получить ответ от ассистента');
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="assistant-page">
      <SectionHeader title="AI-ассистент" subtitle="Контекст обсуждения, подсказки и быстрые ответы по проекту" />

      <section className="assistant-context">
        {assistantContext.map((item) => (
          <div className="context-chip" key={item}>
            {item}
          </div>
        ))}
      </section>

      <form className="assistant-form" onSubmit={handleSubmit}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Спросите ассистента, кто отвечает, какие есть задачи или попросите резюме"
          disabled={loading}
        />
        <button className="primary-button" type="submit" disabled={loading || !question.trim()}>
          {loading ? 'Загрузка...' : 'Спросить'}
        </button>
      </form>

      {error && (
        <div className="contacts-error">
          {error}
          <button 
            type="button" 
            className="secondary-button" 
            onClick={() => setError(null)}
            style={{ marginLeft: '10px' }}
          >
            Повторить
          </button>
        </div>
      )}

      <div className="actions-grid actions-grid--wide">
        {assistantQuickActions.map((action) => (
          <button 
            className="secondary-button secondary-button--soft" 
            key={action} 
            type="button" 
            onClick={() => handleQuickAction(action)}
            disabled={loading}
          >
            {action}
          </button>
        ))}
      </div>

      <section className="assistant-cards">
        {loading && cards.length === 0 && (
          <div className="contacts-empty">Загрузка ответа...</div>
        )}
        {!loading && cards.length === 0 && (
          <div className="contacts-empty contacts-empty--large">
            <h3>Нет истории запросов</h3>
            <p className="contacts-empty__text">
              Задайте вопрос или выберите быстрый запрос выше
            </p>
          </div>
        )}
        {cards.map((card) => (
          <article className="insight-card insight-card--large" key={card.id}>
            <strong>{card.title}</strong>
            <p>{card.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export default AssistantPage;
