import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import logoAuth from '../../logoAuth.png';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');

  const fillDemo = (role) => {
    setForm(role === 'admin' ? { login: 'admin', password: 'admin123' } : { login: 'user', password: '123456' });
    setError('');
  };

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
    <div className="login-page">
      <div className="login-card">
        <Logo src={logoAuth} hideText />
        <div className="login-card__heading">
          <h1>Вход в систему</h1>
          <p>Авторизуйтесь, чтобы перейти в рабочее пространство ТелеграфЪ.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Логин</span>
            <input
              value={form.login}
              onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))}
              placeholder="Введите логин"
            />
          </label>

          <label>
            <span>Пароль</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Введите пароль"
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button login-form__submit" type="submit">
            Войти
          </button>
        </form>

        <div className="demo-accounts">
          <button className="demo-account" type="button" onClick={() => fillDemo('user')}>
            <strong>Пользователь</strong>
            <span>user / 123456</span>
          </button>
          <button className="demo-account" type="button" onClick={() => fillDemo('admin')}>
            <strong>Администратор</strong>
            <span>admin / admin123</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
