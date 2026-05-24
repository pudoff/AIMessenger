import { request } from './client';

// Получение статистики по пользователям (общее количество)
const getUsersStats = async () => {
  const data = await request('/users/');
  return { total: data?.count ?? 0 };
};

// Получение статистики по чатам
const getChatsStats = async () => {
  const [allChats, corporateChats] = await Promise.all([
    request('/chats/'),
    request('/chats/?type=corporate')
  ]);

  const activeCount = Array.isArray(allChats?.results) ? allChats.results.length : (Array.isArray(allChats) ? allChats.length : 0);
  const corporateCount = Array.isArray(corporateChats?.results) ? corporateChats.results.length : (Array.isArray(corporateChats) ? corporateChats.length : 0);

  return {
    active: activeCount,
    corporate: corporateCount
  };
};

export const adminAPI = {
  // Пользователи
  getUsers: async (page = 1) => {
    const data = await request(`/users/?page=${page}`);
    return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  },
  updateUser: (id, data) => request(`/users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getUsersStats,
  getChatsStats,

  // События
  getEvents: async () => {
    const data = await request('/admin/events/');
    return data || {};
  },

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
  getCorporateChats: async () => {
    const data = await request('/chats/?type=corporate');
    return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  },
};