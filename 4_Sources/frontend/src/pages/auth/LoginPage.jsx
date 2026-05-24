// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import logoAuth from '../../assets/logo_new.png';
import PasswordRecoveryForm from '../../components/auth/PasswordRecoveryForm';

function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuth();
  
  const [form, setForm] = useState({ login: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    
    const result = await login(form.login.trim(), form.password);
    
    if (result.success) {
      navigate(result.user?.role === 'admin' ? '/admin' : '/app', { replace: true });
    }
  };

  if (isRecoveryMode) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Logo src={logoAuth} hideText />
          <PasswordRecoveryForm
            onSubmit={(email) => console.log('[DEMO] Reset to:', email)}
            onBack={() => setIsRecoveryMode(false)}
            onCancel={() => setIsRecoveryMode(false)}
          />
        </div>
      </div>
    );
  }

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
              onChange={(e) => {
                setForm(prev => ({ ...prev, login: e.target.value }));
                clearError();
              }}
              placeholder="Введите логин"
              disabled={loading}
              required
            />
          </label>

          <label className="password-field">
            <span>Пароль</span>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, password: e.target.value }));
                  clearError();
                }}
                placeholder="Введите пароль"
                disabled={loading}
                required
              />
              {/* <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                disabled={loading}
              >
                {showPassword ? '⚫' : '👁️'}
              </button> */}
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button 
            className="primary-button auth-form__submit" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
          
          <div className="auth-form__footer">
            <span>Нету аккаунта? </span>
            <Link to="/register" className="auth-form__footer-link">Зарегистрироваться</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
