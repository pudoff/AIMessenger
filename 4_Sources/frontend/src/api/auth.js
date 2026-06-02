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

  updateMe: (data) => {
    const hasFile = data.avatar instanceof File;
    if (hasFile) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });
      return request('/me/', { method: 'PATCH', body: formData });
    }
    return request('/me/', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },
  
  // 🚪 Выход (просто удаляем токен на клиенте)
  logout: () => {
    localStorage.removeItem('auth_token');
    return Promise.resolve({ success: true });
  }
};
