// src/utils/validation.js

export const validateField = (name, value, form = {}) => {
  switch (name) {
    case 'firstName':
    case 'lastName':
      if (!value.trim()) return 'Это поле обязательно';
      if (value.trim().length < 2) return 'Минимум 2 символа';
      if (!/^[\p{L}\p{M}'-]+$/u.test(value.trim())) return 'Только буквы, дефис и апостроф';
      return null;

    case 'username':
      if (!value.trim()) return 'Это поле обязательно';
      if (!/^[a-zA-Z0-9_.+-]+$/.test(value)) return 'Только латиница, цифры и символы _ . + -';
      if (value.length < 3) return 'Минимум 3 символа';
      return null;

    case 'email':
      if (!value.trim()) return 'Это поле обязательно';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Некорректный формат email';
      return null;

    case 'phone':
      if (!value) return 'Это поле обязательно';
      if (value.length !== 10) return 'Введите 10 цифр номера';
      return null;

    case 'birthDate':
      if (!value) return 'Выберите дату';
      const birth = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear();
      if (birth > today) return 'Дата не может быть в будущем';
      if (age < 14 || age > 100) return 'Возраст должен быть от 14 до 100 лет';
      return null;

    case 'password':
      if (!value) return 'Это поле обязательно';
      if (value.length < 8) return 'Минимум 8 символов';
      // Дополнительные проверки 
      if (/^\d+$/.test(value)) return 'Пароль не должен состоять только из цифр';
      if (value.toLowerCase().includes('password') || value.toLowerCase().includes('qwerty')) {
        return 'Пароль слишком простой';
      }
      return null;

    case 'confirmPassword':
      if (!value) return 'Подтвердите пароль';
      if (value !== form.password) return 'Пароли не совпадают';
      return null;

    case 'accepted_user_agreement':
    case 'accepted_privacy_policy':
      if (!value) return 'Необходимо согласие';
      return null;

    default:
      return null;
  }
};

// Парсинг ошибок от бэкенда (DRF format)
export const parseBackendErrors = (errors) => {
  if (!errors || typeof errors !== 'object') return {};

  const source = errors.field_errors && typeof errors.field_errors === 'object'
    ? errors.field_errors
    : errors;
  const fieldMap = {
    first_name: 'firstName',
    last_name: 'lastName',
    birth_date: 'birthDate',
    phone_number: 'phone',
    confirm_password: 'confirmPassword',
    non_field_errors: '_global',
  };
  const mapped = {};
  for (const [field, messages] of Object.entries(source)) {
    if (['detail', 'code', 'field_errors'].includes(field)) continue;
    // DRF возвращает массив строк: ["Ошибка 1", "Ошибка 2"]
    const frontendField = fieldMap[field] || field;
    mapped[frontendField] = Array.isArray(messages)
      ? messages.map((message) => normalizeBackendFieldMessage(frontendField, message)).join('. ')
      : normalizeBackendFieldMessage(frontendField, messages);
  }
  return mapped;
};

const normalizeBackendFieldMessage = (field, message) => {
  if (!message) return '';

  const text = String(message).trim();
  const lower = text.toLowerCase();
  const exists = lower.includes('существ') || lower.includes('already exists') || lower.includes('занят');

  if (exists && field === 'username') {
    return 'Этот логин уже занят. Выберите другой логин или войдите в существующий аккаунт.';
  }

  if (exists && field === 'email') {
    return 'Пользователь с таким e-mail уже зарегистрирован. Войдите в аккаунт или восстановите доступ.';
  }

  if (exists && field === 'phone') {
    return 'Пользователь с таким номером телефона уже зарегистрирован.';
  }

  return normalizeBackendMessage(text);
};

/**
 * 🚨 РАСШИРЕННАЯ нормализация ошибок от бэкенда
 * Обрабатывает намного больше случаев ошибок
 */
export const normalizeBackendMessage = (message) => {
  if (!message) return '';

  const text = String(message).trim();
  const lower = text.toLowerCase();

  // ═════════════════════════════════════════════════════════
  // 🔐 ОШИБКИ АУТЕНТИФИКАЦИИ
  // ═════════════════════════════════════════════════════════
  
  if (lower.includes('unable to log in') || 
      lower.includes('provided credentials') ||
      lower.includes('authentication') ||
      lower.includes('invalid credentials')) {
    return 'Неверный логин или пароль. Проверьте корректность данных';
  }

  if (lower.includes('не зарегистрировано') || 
      lower.includes("doesn't exist") ||
      lower.includes('user not found') ||
      lower.includes('не найдено')) {
    return 'Аккаунт не найден. Может быть опечатка в логине или email?';
  }

  if (lower.includes('not verified') || 
      lower.includes('email confirmation') ||
      lower.includes('не подтвержден')) {
    return 'Ваш email еще не подтвержден. Проверьте письмо подтверждения';
  }

  // ═════════════════════════════════════════════════════════
  // 👤 ОШИБКИ РЕГИСТРАЦИИ (СУЩЕСТВОВАНИЕ ПОЛЬЗОВАТЕЛЯ)
  // ═════════════════════════════════════════════════════════
  
  if (lower.includes('user with that username') || 
      lower.includes('a user with that username')) {
    return 'Этот логин уже занят. Выберите другой';
  }

  if (lower.includes('user with this email') || 
      lower.includes('this email already exists')) {
    return 'Этот email уже зарегистрирован. Попробуйте восстановить доступ';
  }

  if (lower.includes('user with this phone') || 
      lower.includes('this phone number already exists')) {
    return 'Номер телефона уже зарегистрирован. Используйте другой';
  }

  if ((lower.includes('already exists') || lower.includes('существ')) && 
      !lower.includes('username') && 
      !lower.includes('email') && 
      !lower.includes('phone')) {
    return 'Такой пользователь уже зарегистрирован';
  }

  // ═════════════════════════════════════════════════════════
  // 🔑 ОШИБКИ ПАРОЛЯ
  // ═════════════════════════════════════════════════════════
  
  if (lower.includes('too common')) {
    return 'Пароль слишком простой. Используйте буквы и цифры';
  }

  if (lower.includes('entirely numeric')) {
    return 'Пароль не должен состоять только из цифр';
  }

  if (lower.includes('too short') || lower.includes('at least 8')) {
    return 'Пароль слишком короткий. Минимум 8 символов';
  }

  if (lower.includes('too similar')) {
    return 'Пароль слишком похож на личные данные';
  }

  if (lower.includes('password') && 
      (lower.includes('invalid') || lower.includes('error') || lower.includes('ошибка'))) {
    return 'Пароль не соответствует требованиям безопасности';
  }

  // ═════════════════════════════════════════════════════════
  // 📧 ОШИБКИ EMAIL И ПИСЬМА
  // ═════════════════════════════════════════════════════════
  
  if (lower.includes('email_delivery_failed') || 
      lower.includes('не удалось отправить письмо') ||
      lower.includes('failed to send email')) {
    return 'Не удалось отправить письмо подтверждения. Попробуйте позже или обратитесь к администратору';
  }

  if (lower.includes('invalid email') || 
      lower.includes('incorrect email')) {
    return 'Некорректный формат email. Проверьте правильность введенного адреса';
  }

  // ═════════════════════════════════════════════════════════
  // 🔗 ОШИБКИ ВОССТАНОВЛЕНИЯ ДОСТУПА (ССЫЛКИ)
  // ═════════════════════════════════════════════════════════
  
  if (lower.includes('link expired') || 
      lower.includes('ссылка истекла') ||
      lower.includes('token expired')) {
    return 'Ссылка истекла. Запросите новую ссылку восстановления';
  }

  if (lower.includes('invalid link') || 
      lower.includes('token invalid') ||
      lower.includes('невалидна')) {
    return 'Ссылка невалидна или уже была использована. Запросите новую';
  }

  // ═════════════════════════════════════════════════════════
  // ⚠️ ОБЩИЕ ОШИБКИ ВАЛИДАЦИИ
  // ═════════════════════════════════════════════════════════
  
  if (lower.includes('validation error') || 
      lower.includes('ошибка валидации') ||
      lower.includes('invalid')) {
    return 'Ошибка валидации. Проверьте выделенные поля и исправьте ошибки';
  }

  if (lower.includes('request failed') || 
      lower.includes('ошибка запроса') ||
      lower.includes('failed')) {
    return 'Ошибка при обработке запроса. Повторите попытку';
  }

  if (lower.includes('must be unique') || 
      lower.includes('должно быть уникальным')) {
    return 'Это значение должно быть уникальным';
  }

  if (lower.includes('required') || 
      lower.includes('обязательное')) {
    return 'Это поле обязательно';
  }

  // ═════════════════════════════════════════════════════════
  // 🔐 ОШИБКИ ПРАВ ДОСТУПА
  // ═════════════════════════════════════════════════════════
  
  if (lower.includes('permission') || 
      lower.includes('access denied') ||
      lower.includes('не допускается')) {
    return 'У вас нет прав для этого действия';
  }

  // Если ничего не подошло - возвращаем оригинальное сообщение
  return text;
};

export const getFirstBackendError = (data) => {
  const fieldErrors = parseBackendErrors(data);
  const fieldMessage = Object.entries(fieldErrors)
    .find(([field, message]) => field !== '_global' && message)?.[1];

  return (
    fieldErrors._global ||
    fieldMessage ||
    normalizeBackendMessage(data?.detail) ||
    normalizeBackendMessage(data?.non_field_errors?.[0]) ||
    'Ошибка запроса. Попробуйте еще раз.'
  );
};

// Требования к паролю для отображения подсказок
export const PASSWORD_REQUIREMENTS = [
  { test: (val) => val.length >= 8, text: 'Минимум 8 символов' },
  { test: (val) => /[a-z]/.test(val) && /[A-Z]/.test(val), text: 'Заглавные и строчные буквы' },
  { test: (val) => /\d/.test(val), text: 'Хотя бы одна цифра' },
  { test: (val) => !/^\d+$/.test(val), text: 'Не только цифры' },
];

