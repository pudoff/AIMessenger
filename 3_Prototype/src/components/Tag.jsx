function Tag({ value }) {
  if (!value) {
    return null;
  }

  const map = {
    Вопрос: 'tag tag--question',
    Задача: 'tag tag--task',
    Обычное: 'tag tag--default'
  };

  return <span className={map[value] || 'tag tag--default'}>{value}</span>;
}

export default Tag;
