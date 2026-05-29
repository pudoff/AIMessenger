import { request } from './client';

export const chatsAPI = {
  // Список чатов пользователя
  getList: (page = 1) => request(`/chats/?page=${page}`),
  
  // Детали чата
  getOne: (id) => request(`/chats/${id}/`),
  
  // Создать чат (групповой или личный)
  create: (data) => request('/chats/', { method: 'POST', body: JSON.stringify(data) }),
  
  // Открыть/создать личный чат с контактом
  openDirect: (contactId) => request(`/contacts/${contactId}/direct-chat/`, { method: 'POST' }),

  markRead: (chatId, lastMessageId = null) => request(`/chats/${chatId}/mark-read/`, {
    method: 'POST',
    body: JSON.stringify(lastMessageId ? { last_message_id: lastMessageId } : {}),
  }),
};

export const messagesAPI = {
  // Сообщения чата с пагинацией
  getList: (chatId, page = 1, pageSize = 200) => request(`/messages/?chat=${chatId}&page=${page}&page_size=${pageSize}`),
  
  // Отправить сообщение
  send: (data) => request('/messages/', { method: 'POST', body: JSON.stringify(data) }),
};
