import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

import logoAuth from '../../assets/logo_new.png';
import Logo from '../../components/Logo';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, hidePassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = login(form);

    if (!result.success) {
      setError(result.message);
      return;
    }

    navigate(result.user.role === 'admin' ? '/admin' : '/app', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo src={logoAuth} hideText />
        <div className="auth-card__heading">
          <h1>Вход в систему</h1>
          <p>Авторизуйтесь, чтобы перейти в рабочее пространство "Наш слон".</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Логин</span>
            <input
              value={form.login}
              onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))}
              placeholder="Введите логин или почту"
            />
          </label>

          <label className="password-field">
            <span>Пароль</span>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'} 
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Введите пароль"
              />
              <button
                type="button" 
                className="toggle-password-btn"
                onClick={() => hidePassword((prev) => !prev)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? '⚫' : '👁️'}
              </button>
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button auth-form__submit" type="submit">
            Войти
          </button>
          <div className="auth-form__register">
              <span>Нету аккаунта? </span>
              <Link to="/register" className="auth-form__register-link">Зарегистрироваться</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
