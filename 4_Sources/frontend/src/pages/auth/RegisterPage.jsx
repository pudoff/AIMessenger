import { useState, useEffect } from 'react'; //  добавили useEffect
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatPhone, cleanPhone } from '../../utils/phoneMask';
import { LEGAL_CONTENT } from '../../data/legalContent';
import { validateField, parseBackendErrors, PASSWORD_REQUIREMENTS } from '../../utils/validation'; //  импорт

import Logo from '../../components/Logo';
import LegalModal from '../../components/auth/LegalModal';

function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading, error: globalError, clearError } = useAuth();

  const [form, setForm] = useState({
    firstName: '', lastName: '', birthDate: '', username: '',
    phone: '', email: '', password: '', confirmPassword: '',
    accepted_user_agreement: false, accepted_privacy_policy: false
  });
  
  const [fieldErrors, setFieldErrors] = useState({}); //  Ошибки по полям
  const [touched, setTouched] = useState({}); //  Отслеживаем, было ли поле сфокусировано
  const [activeModal, setActiveModal] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  

  //  Валидация поля при изменении (только если поле уже "трогали")
  useEffect(() => {
    const errors = {};
    for (const [name, value] of Object.entries(form)) {
      if (touched[name] || value) { // Валидируем, если поле трогали или оно не пустое
        const err = validateField(name, value, form);
        if (err) errors[name] = err;
      }
    }
    setFieldErrors(errors);
  }, [form, touched]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    
    if (name === 'phone') {
      const cleaned = cleanPhone(value);
      setForm(prev => ({ ...prev, phone: cleaned }));
      return;
    }
    
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    clearError(); // Сбрасываем глобальную ошибку при любом вводе
  };

  //  Помечаем поле как "тронутое" при потере фокуса
  const handleBlur = (event) => {
    const { name } = event.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    
    //  Валидируем ВСЕ поля перед отправкой
    const newTouched = {};
    const newErrors = {};
    let hasError = false;
    
    for (const field of Object.keys(form)) {
      newTouched[field] = true;
      const err = validateField(field, form[field], form);
      if (err) {
        newErrors[field] = err;
        hasError = true;
      }
    }
    
    setTouched(newTouched);
    setFieldErrors(newErrors);
    
    if (hasError) {
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const payload = {
      username: form.username.trim(),
      password: form.password,
      email: form.email.trim().toLowerCase(),
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      birth_date: form.birthDate,
      phone_number: `+7${form.phone}`,
      accepted_user_agreement: true,
      accepted_privacy_policy: true
    };

    const result = await register(payload);
    
    if (result.success) {
      setIsSubmitted(true);
      navigate('/app', { replace: true });
    } else {
      const backendErrors = parseBackendErrors(result.errors || {});
      setFieldErrors(prev => ({ ...prev, ...backendErrors }));
      
      const firstBackendError = Object.keys(backendErrors)[0];
      if (firstBackendError) {
        const element = document.querySelector(`[name="${firstBackendError}"]`);
        element?.focus();
      }
    }
  };

  //  Форма валидна, если нет ошибок в тронутых полях и все обязательные заполнены
  const isFormValid = 
    !Object.values(fieldErrors).some(err => err) &&
    form.firstName.trim() && form.lastName.trim() && form.birthDate &&
    form.username.trim() && form.phone.length === 10 &&
    form.email.trim() && form.password && form.confirmPassword &&
    form.password === form.confirmPassword &&
    form.accepted_user_agreement && form.accepted_privacy_policy;

  // ─────────────────────────────────────────────────────────
  //  Экран успеха
  // ─────────────────────────────────────────────────────────
  // if (isSubmitted) {
  //   return (
  //     <div className="auth-page">
  //       <div className="auth-card">
  //         <Logo hideText />
  //         <div className="auth-card__heading">
  //           <h1>✅ Проверьте почту</h1>
  //           <p>Мы отправили ссылку для подтверждения на <strong>{form.email}</strong></p>
  //         </div>
  //         <div className="auth-form" style={{ textAlign: 'left', padding: '0 8px' }}>
  //           <p style={{ color: 'var(--text-soft)', marginBottom: '24px' }}>
  //             Перейдите по ссылке из письма, чтобы активировать аккаунт.
  //           </p>
  //           <button 
  //             className="secondary-button" 
  //             type="button" 
  //             onClick={() => navigate('/login')}
  //             style={{ width: '100%' }}
  //           >
  //             Перейти ко входу
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  // ─────────────────────────────────────────────────────────
  //  Форма регистрации
  // ─────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo hideText />
        <div className="auth-card__heading">
          <h1>Регистрация</h1>
          <p>Заполните данные, чтобы перейти в рабочее пространство "Наш слон".</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate> {/*  noValidate отключаем браузерную валидацию */}
          
          {/* Имя и Фамилия */}
          <div className="auth-form__row">
            <label className={fieldErrors.firstName && touched.firstName ? 'auth-form__label--error' : ''}>
              <span>Имя *</span>
              <input 
                name="firstName" 
                value={form.firstName} 
                onChange={handleChange} 
                onBlur={handleBlur}
                placeholder="Иван" 
                required 
                disabled={loading}
                aria-invalid={!!(fieldErrors.firstName && touched.firstName)}
                aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
              />
              {fieldErrors.firstName && touched.firstName && (
                <span id="firstName-error" className="auth-form__field-error">{fieldErrors.firstName}</span>
              )}
            </label>
            <label className={fieldErrors.lastName && touched.lastName ? 'auth-form__label--error' : ''}>
              <span>Фамилия *</span>
              <input 
                name="lastName" 
                value={form.lastName} 
                onChange={handleChange} 
                onBlur={handleBlur}
                placeholder="Иванов" 
                required 
                disabled={loading}
                aria-invalid={!!(fieldErrors.lastName && touched.lastName)}
              />
              {fieldErrors.lastName && touched.lastName && (
                <span className="auth-form__field-error">{fieldErrors.lastName}</span>
              )}
            </label>
          </div>

          {/* Дата рождения */}
          <div className="auth-form__field">
            <span className="auth-form__label">Дата рождения *</span>
            <input 
              name="birthDate" 
              type="date" 
              value={form.birthDate} 
              onChange={handleChange} 
              onBlur={handleBlur}
              required 
              disabled={loading}
              aria-invalid={!!(fieldErrors.birthDate && touched.birthDate)}
            />
            {fieldErrors.birthDate && touched.birthDate && (
              <span className="auth-form__field-error">{fieldErrors.birthDate}</span>
            )}
          </div>

          {/* Логин */}
          <label className={fieldErrors.username && touched.username ? 'auth-form__label--error' : ''}>
            <span>Логин для чата *</span>
            <input 
              name="username" 
              value={form.username} 
              onChange={handleChange} 
              onBlur={handleBlur}
              placeholder="ivan_ivanov (латиница, цифры, _)" 
              pattern="^[a-zA-Z0-9_.+-]+$"
              required 
              disabled={loading}
              aria-invalid={!!(fieldErrors.username && touched.username)}
            />
            {fieldErrors.username && touched.username && (
              <span className="auth-form__field-error">{fieldErrors.username}</span>
            )}
            {!fieldErrors.username && form.username && /^[a-zA-Z0-9_.+-]+$/.test(form.username) && form.username.length >= 3 && (
              <span className="auth-form__field-success">✓ Допустимый формат</span>
            )}
          </label>

          {/* Телефон */}
          <label className={fieldErrors.phone && touched.phone ? 'auth-form__label--error' : ''}>
            <span>Телефон *</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              value={formatPhone(form.phone)}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="+7 (___) ___-__-__"
              required
              disabled={loading}
              aria-invalid={!!(fieldErrors.phone && touched.phone)}
            />
            {fieldErrors.phone && touched.phone && (
              <span className="auth-form__field-error">{fieldErrors.phone}</span>
            )}
          </label>

          {/* Email */}
          <label className={fieldErrors.email && touched.email ? 'auth-form__label--error' : ''}>
            <span>Почта *</span>
            <input 
              name="email" 
              type="email" 
              value={form.email} 
              onChange={handleChange} 
              onBlur={handleBlur}
              placeholder="example@mail.ru" 
              required 
              disabled={loading}
              aria-invalid={!!(fieldErrors.email && touched.email)}
            />
            {fieldErrors.email && touched.email && (
              <span className="auth-form__field-error">{fieldErrors.email}</span>
            )}
          </label>

          {/* Пароль с подсказками требований */}
          <label className={fieldErrors.password && touched.password ? 'auth-form__label--error' : ''}>
            <span>Пароль *</span>
            <input 
              name="password" 
              type="password" 
              value={form.password} 
              onChange={handleChange} 
              onBlur={handleBlur}
              placeholder="Придумайте надёжный пароль" 
              required 
              minLength={8}
              disabled={loading}
              aria-invalid={!!(fieldErrors.password && touched.password)}
              aria-describedby="password-requirements"
            />
            
            {/*  Подсказки требований к паролю */}
            <ul id="password-requirements" className="password-requirements">
              {PASSWORD_REQUIREMENTS.map((req, i) => {
                const isMet = form.password ? req.test(form.password) : false;
                const showAsError = touched.password && !isMet && fieldErrors.password;
                return (
                  <li 
                    key={i} 
                    className={`password-requirement ${isMet ? 'password-requirement--met' : ''} ${showAsError ? 'password-requirement--error' : ''}`}
                  >
                    <span className="password-requirement__icon">{isMet ? '✓' : '○'}</span>
                    {req.text}
                  </li>
                );
              })}
            </ul>
            
            {/* Ошибка пароля (в т.ч. от бэкенда) */}
            {fieldErrors.password && touched.password && (
              <span className="auth-form__field-error auth-form__field-error--block">{fieldErrors.password}</span>
            )}
          </label>

          {/* Подтверждение пароля */}
          <label className={fieldErrors.confirmPassword && touched.confirmPassword ? 'auth-form__label--error' : ''}>
            <span>Повторите пароль *</span>
            <input 
              name="confirmPassword" 
              type="password" 
              value={form.confirmPassword} 
              onChange={handleChange} 
              onBlur={handleBlur}
              placeholder="Подтвердите пароль" 
              required 
              disabled={loading}
              aria-invalid={!!(fieldErrors.confirmPassword && touched.confirmPassword)}
            />
            {fieldErrors.confirmPassword && touched.confirmPassword && (
              <span className="auth-form__field-error">{fieldErrors.confirmPassword}</span>
            )}
            {form.confirmPassword && form.password === form.confirmPassword && touched.confirmPassword && (
              <span className="auth-form__field-success">✓ Пароли совпадают</span>
            )}
          </label>

          {/* Чекбоксы соглашений */}
          <div className="auth-form__agreements">
            <label className={`auth-form__checkbox ${fieldErrors.accepted_user_agreement && touched.accepted_user_agreement ? 'auth-form__checkbox--error' : ''}`}>
              <input 
                type="checkbox" 
                name="accepted_user_agreement" 
                checked={form.accepted_user_agreement} 
                onChange={handleChange} 
                onBlur={handleBlur}
                required 
                disabled={loading} 
              />
              <span>
                Я принимаю{' '}
                <button type="button" className="auth-form__link-btn" onClick={() => setActiveModal('terms')} disabled={loading}>
                  пользовательское соглашение
                </button>{' '}
                *
              </span>
              {fieldErrors.accepted_user_agreement && touched.accepted_user_agreement && (
                <span className="auth-form__field-error">{fieldErrors.accepted_user_agreement}</span>
              )}
            </label>
            <label className={`auth-form__checkbox ${fieldErrors.accepted_privacy_policy && touched.accepted_privacy_policy ? 'auth-form__checkbox--error' : ''}`}>
              <input 
                type="checkbox" 
                name="accepted_privacy_policy" 
                checked={form.accepted_privacy_policy} 
                onChange={handleChange} 
                onBlur={handleBlur}
                required 
                disabled={loading} 
              />
              <span>
                Я соглашаюсь с{' '}
                <button type="button" className="auth-form__link-btn" onClick={() => setActiveModal('privacy')} disabled={loading}>
                  политикой конфиденциальности
                </button>{' '}
                *
              </span>
              {fieldErrors.accepted_privacy_policy && touched.accepted_privacy_policy && (
                <span className="auth-form__field-error">{fieldErrors.accepted_privacy_policy}</span>
              )}
            </label>
          </div>

          {/* Глобальная ошибка (не по полям) */}
          {globalError && <div className="form-error">{globalError}</div>}

          <button 
            className="primary-button auth-form__submit" 
            type="submit" 
            disabled={!isFormValid || loading}
            aria-busy={loading}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <div className="auth-form__footer">
            <span>Уже есть аккаунт? </span>
            <Link to="/login" className="auth-form__footer-link">Войти</Link>
          </div>
        </form>
      </div>

      <LegalModal isOpen={activeModal === 'terms'} onClose={() => setActiveModal(null)} title={LEGAL_CONTENT.terms.title} sections={LEGAL_CONTENT.terms.sections} />
      <LegalModal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} title={LEGAL_CONTENT.privacy.title} sections={LEGAL_CONTENT.privacy.sections} />
    </div>
  );
}

export default RegisterPage;
