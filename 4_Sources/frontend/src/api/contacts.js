// src/api/contacts.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Вспомогательная функция с обработкой пустых ответов
const request = async (endpoint, opts = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Token ${token}` }),
      ...opts.headers,
    },
  });

  // 204 No Content или пустой ответ — не парсим JSON
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.non_field_errors?.[0] || 'Ошибка запроса');
  }
  
  // Безопасный парсинг
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const contactsAPI = {
  // Список моих контактов
  getList: (page = 1) => request(`/contacts/?page=${page}`),
  
  // Поиск пользователей
  search: (query) => request(`/user-search/?q=${encodeURIComponent(query)}`),
  
  // Добавить контакт (ключ 'user' — как требует бэкенд)
  add: (data) => request('/contacts/', { method: 'POST', body: JSON.stringify(data) }),
  
  // Удалить контакт по ID записи
  remove: (id) => request(`/contacts/${id}/`, { method: 'DELETE' }),
  
  // Принимает id записи контакта
  openDirect: (contactId) => request(`/contacts/${contactId}/direct-chat/`, { method: 'POST' }),
  
  // Добавить контакт в групповой чат
  addToGroupChat: (contactId, chatData) => request(`/contacts/${contactId}/add-to-chat/`, {
    method: 'POST', 
    body: JSON.stringify(chatData) 
  }),
};
