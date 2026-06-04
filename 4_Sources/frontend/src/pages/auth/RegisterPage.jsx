import { useState, useEffect } from 'react'; //  добавили useEffect
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatPhone, cleanPhone } from '../../utils/phoneMask';
import { LEGAL_CONTENT } from '../../data/legalContent';
import { validateField, parseBackendErrors, PASSWORD_REQUIREMENTS } from '../../utils/validation'; //  импорт

import Logo from '../../components/Logo';
import LegalModal from '../../components/auth/LegalModal';

const REGISTER_DRAFT_KEY = 'register_form_draft';

const emptyForm = {
  firstName: '',
  lastName: '',
  birthDate: '',
  username: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  accepted_user_agreement: false,
  accepted_privacy_policy: false
};

const loadRegisterDraft = () => {
  try {
    const savedDraft = JSON.parse(sessionStorage.getItem(REGISTER_DRAFT_KEY) || '{}');
    return {
      ...emptyForm,
      ...savedDraft,
      password: '',
      confirmPassword: '',
    };
  } catch {
    return emptyForm;
  }
};

const getCurrentFormErrors = (formValues, extraErrors = {}) => {
  const errors = { ...extraErrors };

  for (const [name, value] of Object.entries(formValues)) {
    const err = validateField(name, value, formValues);

    if (err) {
      errors[name] = err;
    } else {
      delete errors[name];
    }
  }

  return errors;
};

function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { register, loading, error: globalError, clearError } = useAuth();
  const registrationStatus = searchParams.get('registration');

  const [form, setForm] = useState(loadRegisterDraft);
  
  const [fieldErrors, setFieldErrors] = useState({}); //  Ошибки по полям
  const [serverErrors, setServerErrors] = useState({});
  const [touched, setTouched] = useState({}); //  Отслеживаем, было ли поле сфокусировано
  const [activeModal, setActiveModal] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [errorShownTime, setErrorShownTime] = useState(null);
  
  // Отслеживать глобальную ошибку - гарантировать видимость
  useEffect(() => {
    if (globalError) {
      setErrorShownTime(Date.now());
    }
  }, [globalError]);

  // Очищать ошибку с задержкой - минимум 5 секунд видимости
  const clearErrorWithDelay = () => {
    if (!globalError) return;
    
    const timeShown = Date.now() - errorShownTime;
    const minShowTime = 5000; // 5 секунд
    
    if (timeShown < minShowTime) {
      setTimeout(() => {
        clearError();
      }, minShowTime - timeShown);
    } else {
      clearError();
    }
  };
  
  useEffect(() => {
    const { password, confirmPassword, ...draft } = form;
    sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft));
  }, [form]);

  //  Валидация поля при изменении (только если поле уже "трогали")
  useEffect(() => {
    const errors = { ...serverErrors };
    for (const [name, value] of Object.entries(form)) {
      if (touched[name] || value) { // Валидируем, если поле трогали или оно не пустое
        const err = validateField(name, value, form);
        if (err) errors[name] = err;
      }
    }
    setFieldErrors(errors);
  }, [form, touched, serverErrors]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSubmitError('');
    setServerErrors(prev => {
      const next = { ...prev };
      delete next[name];
      delete next._global;
      if (name === 'phone') delete next.phone;
      if (name === 'password') {
        delete next.password;
        delete next.confirmPassword;
      }
      if (name === 'confirmPassword') delete next.confirmPassword;
      return next;
    });
    
    if (name === 'phone') {
      const cleaned = cleanPhone(value);
      setForm(prev => ({ ...prev, phone: cleaned }));
      return;
    }
    
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    clearErrorWithDelay(); // Очищаем глобальную ошибку с задержкой (минимум 5 сек видимости)
  };

  //  Помечаем поле как "тронутое" при потере фокуса
  const handleBlur = (event) => {
    const { name } = event.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    setSubmitError('');
    setServerErrors({});
    
    //  Валидируем ВСЕ поля перед отправкой
    const newTouched = {};
    for (const field of Object.keys(form)) {
      newTouched[field] = true;
    }

    const newErrors = getCurrentFormErrors(form);
    const hasError = Object.keys(newErrors).length > 0;
    
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
      sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      navigate('/login', {
        replace: true,
        state: {
          notice: `Регистрация создана. Мы отправили письмо подтверждения на ${form.email.trim().toLowerCase()}.`,
        },
      });
    } else {
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));

      const backendErrors = parseBackendErrors(result.errors || {});
      const existingAccountError = [backendErrors.username, backendErrors.email]
        .find((message) => typeof message === 'string' && message.toLowerCase().includes('существ'));

      if (existingAccountError) {
        navigate('/login', {
          replace: true,
          state: {
            error: `${existingAccountError} Попробуйте войти или восстановить доступ.`,
          },
        });
        return;
      }

      setServerErrors(backendErrors);
      setFieldErrors(prev => ({ ...prev, ...backendErrors }));
      setTouched(prev => ({
        ...prev,
        ...Object.keys(backendErrors).reduce((acc, field) => ({ ...acc, [field]: true }), {}),
      }));
      setSubmitError(
        backendErrors._global ||
        backendErrors.username ||
        backendErrors.email ||
        backendErrors.phone ||
        result.message ||
        'Не удалось зарегистрироваться. Проверьте данные и попробуйте еще раз.'
      );
      
      const firstBackendError = Object.keys(backendErrors).find((field) => field !== '_global');
      if (firstBackendError) {
        const element = document.querySelector(`[name="${firstBackendError}"]`);
        element?.focus();
      }
    }
  };

  const currentFormErrors = getCurrentFormErrors(form, serverErrors);
  const isFormValid = Object.keys(currentFormErrors).length === 0;

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

        {registrationStatus === 'confirmed' && (
          <div className="form-success">
            Регистрация подтверждена. Теперь вы можете войти в мессенджер.
          </div>
        )}

        {registrationStatus === 'invalid' && (
          <div className="form-error">
            Ссылка подтверждения недействительна или уже была использована.
          </div>
        )}

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
            <div className={`auth-form__checkbox ${fieldErrors.accepted_user_agreement && touched.accepted_user_agreement ? 'auth-form__checkbox--error' : ''}`}>
              <input 
                id="accepted_user_agreement"
                type="checkbox" 
                name="accepted_user_agreement" 
                checked={form.accepted_user_agreement} 
                onChange={handleChange} 
                onBlur={handleBlur}
                required 
                disabled={loading} 
              />
              <div className="auth-form__checkbox-text">
                <label htmlFor="accepted_user_agreement">Я принимаю</label>{' '}
                <button type="button" className="auth-form__link-btn" onClick={() => setActiveModal('terms')} disabled={loading}>
                  пользовательское соглашение
                </button>{' '}
                *
                {fieldErrors.accepted_user_agreement && touched.accepted_user_agreement && (
                  <span className="auth-form__field-error">{fieldErrors.accepted_user_agreement}</span>
                )}
              </div>
            </div>
            <div className={`auth-form__checkbox ${fieldErrors.accepted_privacy_policy && touched.accepted_privacy_policy ? 'auth-form__checkbox--error' : ''}`}>
              <input 
                id="accepted_privacy_policy"
                type="checkbox" 
                name="accepted_privacy_policy" 
                checked={form.accepted_privacy_policy} 
                onChange={handleChange} 
                onBlur={handleBlur}
                required 
                disabled={loading} 
              />
              <div className="auth-form__checkbox-text">
                <label htmlFor="accepted_privacy_policy">Я соглашаюсь с</label>{' '}
                <button type="button" className="auth-form__link-btn" onClick={() => setActiveModal('privacy')} disabled={loading}>
                  политикой конфиденциальности
                </button>{' '}
                *
                {fieldErrors.accepted_privacy_policy && touched.accepted_privacy_policy && (
                  <span className="auth-form__field-error">{fieldErrors.accepted_privacy_policy}</span>
                )}
              </div>
            </div>
          </div>

          {/* Глобальная ошибка (не по полям) */}
          {submitError && (
            <div className="form-error">
              {submitError}{' '}
              <Link to="/login" className="auth-form__footer-link">Перейти ко входу</Link>
            </div>
          )}
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
