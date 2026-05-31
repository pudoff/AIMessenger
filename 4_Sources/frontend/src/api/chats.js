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
  send: (data) => {
    if (data.attachments?.length) {
      const formData = new FormData();
      formData.append('chat', data.chat);
      formData.append('text', data.text || '');
      formData.append('message_type', data.message_type || 'default');
      if (data.task_status) formData.append('task_status', data.task_status);
      if (data.analyst_notes) formData.append('analyst_notes', data.analyst_notes);
      data.attachments.forEach((file) => formData.append('attachments', file));
      return request('/messages/', { method: 'POST', body: formData });
    }
    return request('/messages/', { method: 'POST', body: JSON.stringify(data) });
  },

  semanticSearch: ({ q, chat, limit = 10 }) => {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (chat) params.set('chat', chat);
    return request(`/search/semantic/?${params.toString()}`);
  },
};
