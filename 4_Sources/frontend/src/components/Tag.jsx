const tagLabels = {
  question: 'Вопрос',
  task: 'Задача',
  default: 'Обычное',
  answer: 'Обычное',
  statement: 'Обычное',
  toxic: 'Токсичность',
  offtopic: 'Токсичность',
  needs_review: 'На проверку',
  unknown: 'На проверку',
};

function Tag({ value }) {
  if (!value) {
    return null;
  }

  const label = tagLabels[value] || value;
  const map = {
    Вопрос: 'tag tag--question',
    Задача: 'tag tag--task',
    Обычное: 'tag tag--default',
    Токсичность: 'tag tag--toxic',
    'На проверку': 'tag tag--default',
  };

  return <span className={map[label] || 'tag tag--default'}>{label}</span>;
}

export default Tag;
