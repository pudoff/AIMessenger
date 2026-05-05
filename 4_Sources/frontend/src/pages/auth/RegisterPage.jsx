import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { MOCK_USERS } from '../../data/users';
import { LEGAL_CONTENT } from '../../data/legalContent';
import { formatPhone, cleanPhone } from '../../utils/phoneMask';

import Logo from '../../components/Logo';
import LegalModal from '../../components/LegalModal';

function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    firstName: '', lastName: '', birthDate: '', login: '',
    phone: '', email: '', password: '', confirmPassword: '',
    agreeTerms: false, agreePrivacy: false
  });
  
  const [error, setError] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false); // 👈 Новый стейт

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'phone') {
      const cleaned = cleanPhone(value);
      setForm((prev) => ({ ...prev, phone: cleaned }));
      setError('');
      return;
    }
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    
    const textFields = ['firstName', 'lastName', 'login', 'phone', 'email', 'password', 'confirmPassword', 'birthDate'];
    if (textFields.some((field) => !form[field].trim())) return setError('Заполните все обязательные поля');

    const birth = new Date(form.birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    if (birth > today || age < 14 || age > 100) return setError('Укажите корректную дату рождения (14–100 лет)');

    if (form.phone.length !== 10) return setError('Введите корректный номер телефона');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Введите корректный email');
    if (form.password !== form.confirmPassword) return setError('Пароли не совпадают');
    if (MOCK_USERS.some((u) => u.login?.toLowerCase() === form.login.toLowerCase())) return setError('Этот логин уже занят');
    if (MOCK_USERS.some((u) => u.email?.toLowerCase() === form.email.toLowerCase())) return setError('Этот email уже используется');
    if (!form.agreeTerms || !form.agreePrivacy) return setError('Необходимо принять соглашения');

    // 👇 Создаём пользователя (для демо), но НЕ логиним автоматически
    const newUser = {
      id: Date.now(),
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      birthDate: form.birthDate, login: form.login.trim(),
      phone: `+7${form.phone}`, email: form.email.trim().toLowerCase(),
      password: form.password, role: 'user',
      createdAt: new Date().toISOString(), agreedToTermsAt: new Date().toISOString(),
      isEmailVerified: false // 👈 Флаг для будущей верификации
    };

    MOCK_USERS.push(newUser);
    
    // 👇 Показываем сообщение об успехе вместо авто-входа
    setIsSubmitted(true);
    setError('');
  };

  // Если форма отправлена — показываем экран успеха
  if (isSubmitted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Logo hideText />
          <div className="auth-card__heading">
            <h1>✅ Проверьте почту</h1>
            <p>Мы отправили ссылку для подтверждения на <strong>{form.email}</strong></p>
          </div>

          <div className="auth-form" style={{ textAlign: 'left', padding: '0 8px' }}>
            <p style={{ color: 'var(--text-soft)', marginBottom: '24px' }}>
              Перейдите по ссылке из письма, чтобы активировать аккаунт. 
              Если письмо не пришло в течение 5 минут, проверьте папку «Спам».
            </p>

            <button 
              className="secondary-button" 
              type="button" 
              onClick={() => navigate('/login')}
              style={{ width: '100%' }}
            >
              Перейти ко входу
            </button>

            <button 
              className="auth-form__footer-link" 
              type="button" 
              onClick={() => {
                setIsSubmitted(false);
                setForm({ ...form, password: '', confirmPassword: '' });
                setError('');
              }}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--text-soft)', 
                cursor: 'pointer', 
                font: 'inherit',
                marginTop: '12px'
              }}
            >
              ← Вернуться и изменить данные
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 👇 Обычная форма регистрации (без изменений, кроме текста кнопки)
  const isFormValid = 
    form.firstName.trim() && form.lastName.trim() && form.birthDate &&
    form.login.trim() && form.phone.length === 10 &&
    form.email.trim() && form.password && form.confirmPassword &&
    form.agreeTerms && form.agreePrivacy;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo hideText />
        <div className="auth-card__heading">
          <h1>Регистрация</h1>
          <p>Заполните данные, чтобы перейти в рабочее пространство "Наш слон".</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__row">
            <label>
              <span>Имя *</span>
              <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="Иван" required />
            </label>
            <label>
              <span>Фамилия *</span>
              <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Иванов" required />
            </label>
          </div>

          <div className="auth-form__field">
            <span className="auth-form__label">Дата рождения *</span>
            <input name="birthDate" type="date" value={form.birthDate} onChange={handleChange} required />
          </div>

          <label>
            <span>Логин для чата *</span>
            <input name="login" value={form.login} onChange={handleChange} placeholder="Придумайте логин" required />
          </label>

          <label>
            <span>Телефон *</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              value={formatPhone(form.phone)}
              onChange={handleChange}
              placeholder="+7 (___) ___-__-__"
              required
            />
          </label>

          <label>
            <span>Почта *</span>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="example@mail.ru" required />
          </label>

          <label>
            <span>Пароль *</span>
            <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Придумайте пароль" required minLength={6} />
          </label>

          <label>
            <span>Повторите пароль *</span>
            <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Подтвердите пароль" required />
          </label>

          <div className="auth-form__agreements">
            <label className="auth-form__checkbox">
              <input type="checkbox" name="agreeTerms" checked={form.agreeTerms} onChange={handleChange} required />
              <span>
                Я принимаю{' '}
                <button type="button" className="auth-form__link-btn" onClick={() => setActiveModal('terms')}>
                  пользовательское соглашение
                </button>{' '}
                *
              </span>
            </label>
            <label className="auth-form__checkbox">
              <input type="checkbox" name="agreePrivacy" checked={form.agreePrivacy} onChange={handleChange} required />
              <span>
                Я соглашаюсь с{' '}
                <button type="button" className="auth-form__link-btn" onClick={() => setActiveModal('privacy')}>
                  политикой конфиденциальности
                </button>{' '}
                *
              </span>
            </label>
          </div>

          {error && <div className="form-error">{error}</div>}

          {/* 👇 Кнопка с новым текстом */}
          <button className="primary-button auth-form__submit" type="submit" disabled={!isFormValid}>
            Отправить ссылку на email
          </button>

          <div className="auth-form__footer">
            <span>Уже есть аккаунт? </span>
            <Link to="/login" className="auth-form__footer-link">Войти</Link>
          </div>
        </form>
      </div>

      <LegalModal
        isOpen={activeModal === 'terms'}
        onClose={() => setActiveModal(null)}
        title={LEGAL_CONTENT.terms.title}
        sections={LEGAL_CONTENT.terms.sections}
      />
      <LegalModal
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        title={LEGAL_CONTENT.privacy.title}
        sections={LEGAL_CONTENT.privacy.sections}
      />
    </div>
  );
}

export default RegisterPage;