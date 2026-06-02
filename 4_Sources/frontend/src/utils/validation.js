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
      ? messages.map(normalizeBackendMessage).join('. ')
      : normalizeBackendMessage(messages);
  }
  return mapped;
};

export const normalizeBackendMessage = (message) => {
  if (!message) return '';

  const text = String(message).trim();
  const lower = text.toLowerCase();

  if (lower.includes('email_delivery_failed') || lower.includes('не удалось отправить письмо')) {
    return 'Не удалось отправить письмо подтверждения. Попробуйте позже или обратитесь к администратору.';
  }
  if (lower.includes('validation error') || lower.includes('ошибка валидации')) {
    return 'Ошибка валидации. Проверьте выделенные поля.';
  }
  if (lower.includes('request failed') || lower.includes('ошибка запроса')) {
    return 'Ошибка запроса. Попробуйте еще раз.';
  }
  if (lower.includes('unable to log in') || lower.includes('provided credentials')) {
    return 'Неверный логин или пароль.';
  }
  if (lower.includes('too common')) {
    return 'Пароль слишком простой.';
  }
  if (lower.includes('entirely numeric')) {
    return 'Пароль не должен состоять только из цифр.';
  }
  if (lower.includes('too short')) {
    return 'Пароль слишком короткий.';
  }
  if (lower.includes('too similar')) {
    return 'Пароль слишком похож на личные данные.';
  }

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

