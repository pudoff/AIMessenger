/**
 * 🚨 Расширенная обработка ошибок с более конкретной информацией
 * 
 * Использование:
 * import { getDetailedErrorMessage, categorizeError } from '../utils/errorHandler';
 * 
 * const { message, type, suggestion } = getDetailedErrorMessage(error);
 */

// Типы ошибок для UI
export const ERROR_TYPES = {
  INVALID_CREDENTIALS: 'invalid_credentials', // неверный логин/пароль
  ACCOUNT_NOT_FOUND: 'account_not_found',     // аккаунт не существует
  ACCOUNT_EXISTS: 'account_exists',           // аккаунт уже существует
  EMAIL_EXISTS: 'email_exists',               // email занят
  USERNAME_EXISTS: 'username_exists',         // логин занят
  PHONE_EXISTS: 'phone_exists',               // телефон занят
  VALIDATION_ERROR: 'validation_error',       // ошибка валидации
  NETWORK_ERROR: 'network_error',             // ошибка сети
  SERVER_ERROR: 'server_error',               // ошибка сервера
  UNAUTHORIZED: 'unauthorized',               // 401
  FORBIDDEN: 'forbidden',                     // 403
  NOT_FOUND: 'not_found',                     // 404
  EMAIL_NOT_VERIFIED: 'email_not_verified',   // email не подтвержден
  LINK_EXPIRED: 'link_expired',               // ссылка истекла
  LINK_INVALID: 'link_invalid',               // ссылка невалидна
  RATE_LIMITED: 'rate_limited',               // слишком много попыток
  PASSWORD_WEAK: 'password_weak',             // слабый пароль
};

/**
 * Получить детальное сообщение об ошибке с предложением
 * @param {Error} error - ошибка с полями: message, status, data
 * @returns {{ message: string, type: string, suggestion: string, icon: string }}
 */
export const getDetailedErrorMessage = (error) => {
  const errorType = categorizeError(error);
  
  const messages = {
    [ERROR_TYPES.INVALID_CREDENTIALS]: {
      message: 'Неверный логин или пароль',
      suggestion: 'Проверьте корректность введенных данных',
      icon: '❌',
    },
    [ERROR_TYPES.ACCOUNT_NOT_FOUND]: {
      message: 'Аккаунт не найден',
      suggestion: 'Может быть опечатка в логине или email?',
      icon: '🔍',
    },
    [ERROR_TYPES.EMAIL_EXISTS]: {
      message: 'Этот email уже зарегистрирован',
      suggestion: 'Попробуйте восстановить доступ или используйте другой email',
      icon: '📧',
    },
    [ERROR_TYPES.USERNAME_EXISTS]: {
      message: 'Этот логин уже занят',
      suggestion: 'Выберите другой логин для входа в чат',
      icon: '👤',
    },
    [ERROR_TYPES.PHONE_EXISTS]: {
      message: 'Номер телефона уже зарегистрирован',
      suggestion: 'Используйте другой номер или восстановите доступ',
      icon: '📱',
    },
    [ERROR_TYPES.VALIDATION_ERROR]: {
      message: 'Ошибка валидации данных',
      suggestion: 'Проверьте выделенные поля и исправьте ошибки',
      icon: '⚠️',
    },
    [ERROR_TYPES.NETWORK_ERROR]: {
      message: 'Проблема с интернет-соединением',
      suggestion: 'Проверьте подключение к интернету и повторите попытку',
      icon: '🔗',
    },
    [ERROR_TYPES.SERVER_ERROR]: {
      message: 'Ошибка сервера',
      suggestion: 'Повторите попытку позже. Мы работаем над исправлением',
      icon: '⚙️',
    },
    [ERROR_TYPES.UNAUTHORIZED]: {
      message: 'Сеанс истек',
      suggestion: 'Пожалуйста, авторизуйтесь заново',
      icon: '🔐',
    },
    [ERROR_TYPES.FORBIDDEN]: {
      message: 'Нет прав для этого действия',
      suggestion: 'Обратитесь к администратору если это ошибка',
      icon: '🚫',
    },
    [ERROR_TYPES.NOT_FOUND]: {
      message: 'Ресурс не найден',
      suggestion: 'Страница или данные удалены или недоступны',
      icon: '❓',
    },
    [ERROR_TYPES.EMAIL_NOT_VERIFIED]: {
      message: 'Email не подтвержден',
      suggestion: 'Проверьте письмо подтверждения в почте (включая спам)',
      icon: '✉️',
    },
    [ERROR_TYPES.LINK_EXPIRED]: {
      message: 'Ссылка истекла',
      suggestion: 'Запросите новую ссылку восстановления доступа',
      icon: '⏰',
    },
    [ERROR_TYPES.LINK_INVALID]: {
      message: 'Ссылка невалидна или уже была использована',
      suggestion: 'Запросите новую ссылку восстановления доступа',
      icon: '🔗',
    },
    [ERROR_TYPES.RATE_LIMITED]: {
      message: 'Слишком много попыток входа',
      suggestion: 'Попробуйте позже или восстановите доступ по email',
      icon: '⏱️',
    },
    [ERROR_TYPES.PASSWORD_WEAK]: {
      message: 'Пароль не соответствует требованиям безопасности',
      suggestion: 'Используйте буквы, цифры и минимум 8 символов',
      icon: '🔐',
    },
  };

  const msg = messages[errorType] || {
    message: error.message || 'Неизвестная ошибка',
    suggestion: 'Если проблема persists, свяжитесь с поддержкой',
    icon: '❌',
  };

  return {
    type: errorType,
    ...msg,
  };
};

/**
 * Категоризировать ошибку по типу
 */
export const categorizeError = (error) => {
  if (!error) return ERROR_TYPES.SERVER_ERROR;

  const message = String(error.message || error.data?.detail || '').toLowerCase();
  const status = error.status || error.data?.status;
  const data = error.data || {};

  // Проверяем по статусу
  if (status === 400) {
    // Ошибки валидации - нужно проверить конкретное поле
    if (message.includes('username') || data.username) return ERROR_TYPES.USERNAME_EXISTS;
    if (message.includes('email') || data.email) return ERROR_TYPES.EMAIL_EXISTS;
    if (message.includes('phone') || data.phone_number) return ERROR_TYPES.PHONE_EXISTS;
    if (message.includes('password')) return ERROR_TYPES.PASSWORD_WEAK;
    return ERROR_TYPES.VALIDATION_ERROR;
  }

  if (status === 401) return ERROR_TYPES.UNAUTHORIZED;
  if (status === 403) return ERROR_TYPES.FORBIDDEN;
  if (status === 404) return ERROR_TYPES.NOT_FOUND;
  if (status >= 500) return ERROR_TYPES.SERVER_ERROR;

  // Проверяем по тексту сообщения (для парсинга ошибок от бэкенда)
  if (message.includes('unable to log in') || message.includes('provided credentials')) {
    return ERROR_TYPES.INVALID_CREDENTIALS;
  }
  if (message.includes('already exists') || message.includes('существ')) {
    if (message.includes('username')) return ERROR_TYPES.USERNAME_EXISTS;
    if (message.includes('email')) return ERROR_TYPES.EMAIL_EXISTS;
    if (message.includes('phone')) return ERROR_TYPES.PHONE_EXISTS;
    return ERROR_TYPES.ACCOUNT_EXISTS;
  }
  if (message.includes("doesn't exist") || message.includes('not found') || message.includes('не зарегистрировано')) {
    return ERROR_TYPES.ACCOUNT_NOT_FOUND;
  }
  if (message.includes('not verified') || message.includes('не подтвержден')) {
    return ERROR_TYPES.EMAIL_NOT_VERIFIED;
  }
  if (message.includes('expired') || message.includes('истекла')) {
    return ERROR_TYPES.LINK_EXPIRED;
  }
  if (message.includes('invalid') || message.includes('невалидна')) {
    return ERROR_TYPES.LINK_INVALID;
  }
  if (message.includes('too many attempts') || message.includes('rate limit')) {
    return ERROR_TYPES.RATE_LIMITED;
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return ERROR_TYPES.NETWORK_ERROR;
  }

  // Fallback
  if (status >= 500) return ERROR_TYPES.SERVER_ERROR;
  return ERROR_TYPES.VALIDATION_ERROR;
};

/**
 * Форматировать ошибку для отображения пользователю
 * @param {Error} error
 * @returns {string} отформатированное сообщение
 */
export const formatErrorForUser = (error) => {
  const { icon, message, suggestion } = getDetailedErrorMessage(error);
  return `${icon} ${message}\n${suggestion}`;
};

/**
 * Проверить, является ли ошибка сетевой
 */
export const isNetworkError = (error) => {
  if (!error) return false;
  const type = categorizeError(error);
  return type === ERROR_TYPES.NETWORK_ERROR;
};

/**
 * Проверить, является ли ошибка ошибкой сервера
 */
export const isServerError = (error) => {
  if (!error) return false;
  const type = categorizeError(error);
  return [ERROR_TYPES.SERVER_ERROR, ERROR_TYPES.RATE_LIMITED].includes(type);
};

/**
 * Проверить, нужна ли повторная попытка
 */
export const shouldRetry = (error) => {
  const type = categorizeError(error);
  return [
    ERROR_TYPES.NETWORK_ERROR,
    ERROR_TYPES.SERVER_ERROR,
    ERROR_TYPES.RATE_LIMITED,
  ].includes(type);
};
