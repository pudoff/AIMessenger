import { request } from './client';

export const adminAPI = {
  // Пользователи
  getUsers: (page = 1) => request(`/users/?page=${page}`),
  updateUser: (id, data) => request(`/users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  // События
  getEvents: () => request('/admin/events/'),
  
  // Рассылка
  sendBroadcast: (payload) => request('/admin/email/broadcast/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  
  // Корпоративные чаты
  createCorporateChat: (data) => request('/chats/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Получение корпоративных чатов
  getCorporateChats: () => request('/chats/?type=corporate'),
};
