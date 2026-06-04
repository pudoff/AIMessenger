import { API_BASE } from './config';
import { getFirstBackendError } from '../utils/validation';

const getAuthToken = () => localStorage.getItem('auth_token');
const clearAuthToken = () => localStorage.removeItem('auth_token');

const buildHeaders = (options = {}) => {
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;
  return {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Token ${token}` }),
    ...options.headers,
  };
};

const parseResponse = async (response) => {
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

/**
 * Создать детальное сообщение об ошибке в зависимости от статуса
 */
const getHttpErrorMessage = (status, data) => {
  switch (status) {
    case 400:
      // Validation errors
      return getFirstBackendError(data);
    
    case 401:
      // Unauthorized
      return 'Сеанс истек. Пожалуйста, авторизуйтесь заново';
    
    case 403:
      // Forbidden
      return 'У вас нет прав для этого действия';
    
    case 404:
      // Not found
      return 'Ресурс не найден';
    
    case 429:
      // Too many requests - rate limiting
      return 'Слишком много попыток. Попробуйте позже';
    
    case 500:
    case 502:
    case 503:
    case 504:
      // Server errors
      return 'Ошибка сервера. Пожалуйста, повторите попытку позже';
    
    default:
      return getFirstBackendError(data) || `Ошибка ${status}. Попробуйте еще раз`;
  }
};

/**
 * Retry logic для network errors
 */
const shouldRetryRequest = (error, attempt = 1, maxAttempts = 3) => {
  // Не retry на 400, 401, 403, 404 (это клиентские ошибки)
  if (error.status && error.status >= 400 && error.status < 500) {
    return false;
  }
  
  // Retry на server errors и network errors
  if (!error.status || error.status >= 500) {
    return attempt < maxAttempts;
  }
  
  return false;
};

/**
 * Обработка сетевых ошибок
 */
const handleNetworkError = (originalError) => {
  let message = 'Проблема с интернет-соединением';
  
  if (originalError.name === 'AbortError') {
    message = 'Запрос отменен (timeout)';
  } else if (!navigator.onLine) {
    message = 'Нет интернет-соединения. Проверьте подключение';
  } else if (originalError.message.includes('Failed to fetch')) {
    message = 'Ошибка соединения с сервером. Повторите попытку';
  }
  
  const error = new Error(message);
  error.status = 0; // Network error has no status
  error.data = {};
  error.isNetworkError = true;
  return error;
};

export const request = async (endpoint, options = {}) => {
  let attempt = 0;
  const maxAttempts = 3;
  let lastError;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: buildHeaders(options),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await parseResponse(response);

      if (!response.ok) {
        const error = new Error(getHttpErrorMessage(response.status, data));
        error.status = response.status;
        error.data = data;

        //  Если 401 - очищаем токен
        if (response.status === 401) {
          clearAuthToken();
        }

        throw error;
      }

      return data;
    } catch (err) {
      lastError = err;

      // Если это network error - пробуем retry
      if (err.isNetworkError || !err.status) {
        err = handleNetworkError(err);
        lastError = err;
      }

      // Проверяем, нужен ли retry
      if (shouldRetryRequest(lastError, attempt, maxAttempts)) {
        // Логируем retry для debugging
        console.warn(` Retry attempt ${attempt}/${maxAttempts - 1} для ${endpoint}`);
        // Небольшая задержка перед retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      // Если не нужен retry или это последняя попытка - выбрасываем ошибку
      throw lastError;
    }
  }

  // Если вышли из цикла - выбрасываем последнюю ошибку
  throw lastError;
};

export const apiClient = {
  request,
  getAuthToken,
  clearAuthToken,
};
