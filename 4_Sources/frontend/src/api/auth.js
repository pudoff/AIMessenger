import { API_BASE } from './config';

// Вспомогательная функция для запросов
const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Token ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const error = new Error(data.detail || data.non_field_errors?.[0] || 'Ошибка сервера');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  
  return data;
};

export const authAPI = {
  // 🔐 Логин: получить токен
  login: (username, password) => 
    request('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  
  // 📝 Регистрация нового пользователя
  register: (userData) => 
    request('/register/', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
  
  // 👤 Получить данные текущего пользователя
  requestPasswordReset: (email) =>
    request('/password-reset/', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  confirmPasswordReset: ({ uidb64, token, password, confirmPassword }) =>
    request('/password-reset/confirm/', {
      method: 'POST',
      body: JSON.stringify({
        uidb64,
        token,
        password,
        confirm_password: confirmPassword
      })
    }),

  getMe: () => request('/me/'),
  
  // 🚪 Выход (просто удаляем токен на клиенте)
  logout: () => {
    localStorage.removeItem('auth_token');
    return Promise.resolve({ success: true });
  }
};
