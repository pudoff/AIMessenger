import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="empty-state">
      <h1>Страница не найдена</h1>
      <p>Такого маршрута в прототипе пока нет.</p>
      <Link className="primary-button" to="/login">
        Перейти ко входу
      </Link>
    </div>
  );
}

export default NotFoundPage;
