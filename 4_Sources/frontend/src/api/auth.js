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
  getMe: () => request('/me/'),
  
  // 🚪 Выход (просто удаляем токен на клиенте)
  logout: () => {
    localStorage.removeItem('auth_token');
    return Promise.resolve({ success: true });
  }
};
