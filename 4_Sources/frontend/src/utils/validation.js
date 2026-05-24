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
  
  const mapped = {};
  for (const [field, messages] of Object.entries(errors)) {
    // DRF возвращает массив строк: ["Ошибка 1", "Ошибка 2"]
    mapped[field] = Array.isArray(messages) ? messages.join('. ') : messages;
  }
  return mapped;
};

// Требования к паролю для отображения подсказок
export const PASSWORD_REQUIREMENTS = [
  { test: (val) => val.length >= 8, text: 'Минимум 8 символов' },
  { test: (val) => /[a-z]/.test(val) && /[A-Z]/.test(val), text: 'Заглавные и строчные буквы' },
  { test: (val) => /\d/.test(val), text: 'Хотя бы одна цифра' },
  { test: (val) => !/^\d+$/.test(val), text: 'Не только цифры' },
];

