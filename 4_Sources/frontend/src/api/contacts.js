import { request } from './client';

export const contactsAPI = {
  // Список моих контактов
  getList: (page = 1) => request(`/contacts/?page=${page}`),
  
  // Поиск пользователей
  search: (query) => request(`/user-search/?q=${encodeURIComponent(query)}`),
  
  // Добавить контакт (ключ 'user' — как требует бэкенд)
  add: (data) => request('/contacts/', { method: 'POST', body: JSON.stringify(data) }),
  
  // Удалить контакт по ID записи
  remove: (id) => request(`/contacts/${id}/`, { method: 'DELETE' }),
  
  // Принимает userId (не id записи контакта!)
  openDirect: (userId) => request(`/contacts/${userId}/direct-chat/`, { method: 'POST' }),
  
  // Добавить контакт в групповой чат
  addToGroupChat: (userId, chatData) => request(`/contacts/${userId}/add-to-chat/`, { 
    method: 'POST', 
    body: JSON.stringify(chatData) 
  }),
};
