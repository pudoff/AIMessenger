import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../api/auth';
import Logo from '../../components/Logo';
import logoAuth from '../../assets/logo_new.png';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setError('Введите корректный email: адрес должен содержать @ и домен.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await authAPI.requestPasswordReset(cleanEmail);
      setIsSent(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить письмо. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Logo src={logoAuth} hideText />
          <div className="auth-card__heading">
            <h1>Проверьте почту</h1>
            <p>Если аккаунт с адресом <strong>{email}</strong> существует, мы отправили письмо с дальнейшими инструкциями.</p>
          </div>
          <div className="auth-form">
            <div className="form-success">
              Откройте письмо и перейдите по ссылке. Если аккаунт еще не подтвержден, мы отправим письмо подтверждения регистрации. Если письма нет, проверьте папку «Спам».
            </div>
            <Link to="/login" className="secondary-button">
              Вернуться ко входу
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo src={logoAuth} hideText />
        <div className="auth-card__heading">
          <h1>Восстановление доступа</h1>
          <p>Введите email, указанный при регистрации. Мы отправим ссылку для смены пароля.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className={error ? 'auth-form__label--error' : ''}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError('');
              }}
              placeholder="example@mail.ru"
              required
              disabled={isLoading}
              autoFocus
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button
            className="primary-button auth-form__submit"
            type="submit"
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? 'Отправка...' : 'Отправить ссылку'}
          </button>

          <div className="auth-form__footer">
            <Link to="/login" className="auth-form__footer-link">Назад ко входу</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
