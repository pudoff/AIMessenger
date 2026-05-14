const tagLabels = {
  question: 'Вопрос',
  task: 'Задача',
  default: 'Обычное',
  answer: 'Обычное',
  toxic: 'Обычное',
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
  };

  return <span className={map[label] || 'tag tag--default'}>{label}</span>;
}

export default Tag;
