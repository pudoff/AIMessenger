import { request } from './client';

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
