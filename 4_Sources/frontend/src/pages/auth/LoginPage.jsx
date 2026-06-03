// src/pages/auth/LoginPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, loading, error, clearError } = useAuth();
  
  const registrationStatus = searchParams.get('registration');
  const [form, setForm] = useState({ login: '', password: '' });
  const [notice, setNotice] = useState(
    location.state?.notice ||
    (registrationStatus === 'confirmed' ? 'Регистрация подтверждена. Теперь вы можете войти.' : '')
  );
  const [pageError, setPageError] = useState(
    location.state?.error ||
    (registrationStatus === 'invalid' ? 'Ссылка подтверждения недействительна или уже была использована.' : '')
  );

  useEffect(() => {
    if (location.state?.notice || location.state?.error || registrationStatus) {
      navigate('/login', { replace: true, state: null });
    }
  }, []);

  const clearPageMessages = () => {
    setNotice('');
    setPageError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    clearPageMessages();
    
    const result = await login(form.login.trim(), form.password);
    
    if (result.success) {
      navigate(result.user?.role === 'admin' ? '/admin' : '/app', { replace: true });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo hideText />
        <div className="auth-card__heading">
          <h1>Вход в систему</h1>
          <p>Авторизуйтесь, чтобы перейти в рабочее пространство "Наш слон".</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {notice && <div className="form-success">{notice}</div>}
          {pageError && <div className="form-error">{pageError}</div>}

          <label>
            <span>Логин или e-mail</span>
            <input
              value={form.login}
              onChange={(e) => {
                setForm(prev => ({ ...prev, login: e.target.value }));
                clearError();
                clearPageMessages();
              }}
              placeholder="Введите логин или e-mail"
              disabled={loading}
              required
            />
          </label>

          <label className="password-field">
            <span>Пароль</span>
            <div className="password-input-wrapper">
              <input
                type="password"
                value={form.password}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, password: e.target.value }));
                  clearError();
                  clearPageMessages();
                }}
                placeholder="Введите пароль"
                disabled={loading}
                required
              />
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button 
            className="primary-button auth-form__submit" 
            type="submit"
            disabled={loading || !form.login.trim() || !form.password}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
          
          <div className="auth-form__footer">
            <span>Нет аккаунта? </span>
            <Link to="/register" className="auth-form__footer-link">Зарегистрироваться</Link>
          </div>
          <div className="auth-form__footer">
            <span>Забыли пароль? </span>
            <Link to="/forgot-password" className="auth-form__footer-link">Восстановить доступ</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
