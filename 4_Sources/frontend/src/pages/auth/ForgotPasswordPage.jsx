import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../api/auth';
import Logo from '../../components/Logo';
import logoAuth from '../../assets/logo_new.png';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorShownTime, setErrorShownTime] = useState(null);

  // Очищать ошибку с задержкой - минимум 5 секунд видимости
  const clearErrorWithDelay = () => {
    if (!error) return;
    
    const timeShown = Date.now() - errorShownTime;
    const minShowTime = 5000; // 5 секунд
    
    if (timeShown < minShowTime) {
      setTimeout(() => {
        setError('');
      }, minShowTime - timeShown);
    } else {
      setError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      const err = 'Введите корректный email: адрес должен содержать @ и домен.';
      setError(err);
      setErrorShownTime(Date.now());
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await authAPI.requestPasswordReset(cleanEmail);
      navigate('/login', {
        replace: true,
        state: {
          notice: 'Если пользователь с таким email существует, письмо с дальнейшими инструкциями отправлено.',
        },
      });
    } catch (err) {
      const errMsg = normalizeForgotPasswordError(err.message || 'Не удалось отправить письмо. Попробуйте позже.');
      setError(errMsg);
      setErrorShownTime(Date.now());
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
        <Logo hideText />
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
                clearErrorWithDelay();
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

function normalizeForgotPasswordError(message) {
  const text = String(message || '');
  const lower = text.toLowerCase();
  if (
    lower.includes('не зарегистрировано') ||
    lower.includes('аккаунт не найден') ||
    lower.includes('not found') ||
    lower.includes("doesn't exist")
  ) {
    return 'Аккаунт не найден. Проверьте email.';
  }
  return text;
}

export default ForgotPasswordPage;
