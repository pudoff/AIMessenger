import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authAPI } from '../../api/auth';
import Logo from '../../components/Logo';
import logoAuth from '../../assets/logo_new.png';

const PASSWORD_RULES = [
  { test: (value) => value.length >= 8, text: 'Минимум 8 символов' },
  { test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value), text: 'Заглавные и строчные латинские буквы' },
  { test: (value) => /\d/.test(value), text: 'Хотя бы одна цифра' },
  { test: (value) => !/^\d+$/.test(value), text: 'Не только цифры' },
  { test: (value) => !/(password|qwerty|123456)/i.test(value), text: 'Не очевидный пароль' },
];

function getPasswordError(password, confirmPassword) {
  if (!password) return 'Введите новый пароль.';
  if (!PASSWORD_RULES.every((rule) => rule.test(password))) {
    return 'Пароль не соответствует требованиям сложности.';
  }
  if (!confirmPassword) return 'Подтвердите пароль.';
  if (password !== confirmPassword) return 'Пароли не совпадают.';
  return '';
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { uidb64, token } = useParams();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorShownTime, setErrorShownTime] = useState(null);

  const passwordError = getPasswordError(form.password, form.confirmPassword);
  const isFormValid = !passwordError;

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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    clearErrorWithDelay();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ password: true, confirmPassword: true });

    if (!isFormValid) {
      setError(passwordError);
      setErrorShownTime(Date.now());
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authAPI.confirmPasswordReset({
        uidb64,
        token,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setIsSuccess(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      const backendErrors = err.data || {};
      const firstError = Object.values(backendErrors).flat?.()[0];
      const errMsg = firstError || err.message || 'Не удалось сменить пароль. Запросите новую ссылку.';
      setError(errMsg);
      setErrorShownTime(Date.now());
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Logo src={logoAuth} hideText />
          <div className="auth-card__heading">
            <h1>Пароль изменен</h1>
            <p>Ваш пароль успешно изменен. Сейчас мы перенаправим вас на страницу авторизации.</p>
          </div>
          <div className="form-success">Ваш пароль успешно изменен.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo src={logoAuth} hideText />
        <div className="auth-card__heading">
          <h1>Новый пароль</h1>
          <p>Введите новый пароль и подтвердите его.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className={error && touched.password ? 'auth-form__label--error' : ''}>
            <span>Введите новый пароль</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              placeholder="Придумайте надежный пароль"
              disabled={isLoading}
              required
            />
          </label>

          <ul className="password-requirements">
            {PASSWORD_RULES.map((rule) => {
              const isMet = form.password ? rule.test(form.password) : false;
              return (
                <li key={rule.text} className={`password-requirement ${isMet ? 'password-requirement--met' : ''}`}>
                  <span className="password-requirement__icon">{isMet ? '✓' : '○'}</span>
                  {rule.text}
                </li>
              );
            })}
          </ul>

          <label className={error && touched.confirmPassword ? 'auth-form__label--error' : ''}>
            <span>Подтвердите пароль</span>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
              placeholder="Повторите новый пароль"
              disabled={isLoading}
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button
            className="primary-button auth-form__submit"
            type="submit"
            disabled={isLoading || !form.password || !form.confirmPassword}
          >
            {isLoading ? 'Смена пароля...' : 'Сменить пароль'}
          </button>

          <div className="auth-form__footer">
            <Link to="/forgot-password" className="auth-form__footer-link">Запросить новую ссылку</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
