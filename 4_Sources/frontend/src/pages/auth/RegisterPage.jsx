import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { MOCK_USERS } from '../../data/users';

import Logo from '../../components/Logo';

function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    login: '',
    name: '',
    email: '',
    position: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  // Универсальный обработчик для всех полей
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(''); // Сбрасываем ошибку при любом вводе
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // 1. Проверка на пустоту
    const requiredFields = ['login', 'name', 'email', 'position', 'password', 'confirmPassword'];
    const isEmpty = requiredFields.some((field) => !form[field].trim());
    if (isEmpty) return setError('Заполните все поля');

    // 2. Валидация email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return setError('Введите корректный email');
    }

    // 3. Совпадение паролей
    if (form.password !== form.confirmPassword) {
      return setError('Пароли не совпадают');
    }

    // 4. Проверка уникальности логина
    if (MOCK_USERS.some((user) => user.login === form.login.trim())) {
      return setError('Этот логин уже занят');
    }

    // 5. Проверка уникальности email (регистронезависимо)
    if (MOCK_USERS.some((user) => user.email?.toLowerCase() === form.email.toLowerCase())) {
      return setError('Этот email уже используется');
    }
    
    const newUser = {
      id: Date.now(),
      login: form.login.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      position: form.position.trim(),
      password: form.password,
      role: 'user' // При саморегистрации всегда роль "user"
    };

    MOCK_USERS.push(newUser);

    // Авто-вход после успешной регистрации
    const result = login({ login: newUser.login, password: newUser.password });
    if (result.success) {
      navigate('/app', { replace: true });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo hideText />
        <div className="auth-card__heading">
          <h1>Регистрация</h1>
          <p>Создайте аккаунт, чтобы перейти в рабочее пространство "Наш слон".</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Логин</span>
            <input name="login" value={form.login} onChange={handleChange} placeholder="Придумайте логин" />
          </label>

          <label>
            <span>ФИО</span>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Иванов Иван Иванович" />
          </label>

          <label>
            <span>Почта</span>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="example@mail.ru" />
          </label>

          <label>
            <span>Роль в проекте</span>
            <input name="position" value={form.position} onChange={handleChange} placeholder="Например: Дизайнер" />
          </label>

          <label>
            <span>Пароль</span>
            <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Придумайте пароль" />
          </label>

          <label>
            <span>Повторите пароль</span>
            <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Подтвердите пароль" />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button auth-form__submit" type="submit">
            Зарегистрироваться
          </button>

          <div className="auth-form__footer">
            <span>Уже есть аккаунт? </span>
            <Link to="/login" className="auth-form__footer-link">Войти</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;