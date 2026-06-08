import { request } from './client';
import { API_BASE } from './config';

function buildApiFileUrl(rawUrl) {
  if (!rawUrl) return '';
  if (typeof window === 'undefined') return rawUrl;

  const apiBase = new URL(API_BASE, window.location.origin);
  const parsed = new URL(rawUrl, apiBase.origin);

  if (parsed.pathname.startsWith('/api/')) {
    return `${apiBase.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  return parsed.href;
}

function getAttachmentName(attachment) {
  return attachment.original_name || attachment.name || 'attachment';
}

export async function downloadAttachment(attachment) {
  const blob = await fetchAttachmentBlob(attachment);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = getAttachmentName(attachment);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function fetchAttachmentBlob(attachment) {
  const url = buildApiFileUrl(attachment.download_url || attachment.url || attachment.file_url || attachment.file);
  if (!url) {
    throw new Error('Файл недоступен для скачивания');
  }

  const token = localStorage.getItem('auth_token');
  const response = await fetch(url, {
    headers: token ? { Authorization: `Token ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error('Не удалось скачать файл');
  }

  return response.blob();
}

export const chatsAPI = {
  // Список чатов пользователя
  getList: (page = 1) => request(`/chats/?page=${page}`),
  
  // Детали чата
  getOne: (id) => request(`/chats/${id}/`),
  
  // Создать чат (групповой или личный)
  create: (data) => request('/chats/', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) => request(`/chats/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id) => request(`/chats/${id}/`, { method: 'DELETE' }),
  
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

  update: (id, data) => request(`/messages/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id) => request(`/messages/${id}/`, { method: 'DELETE' }),

  semanticSearch: ({ q, chat, limit = 10 }) => {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (chat) params.set('chat', chat);
    return request(`/search/semantic/?${params.toString()}`);
  },
};

export const chatMembersAPI = {
  getList: (chatId) => request(`/chat-members/?chat=${chatId}`),

  delete: (id) => request(`/chat-members/${id}/`, { method: 'DELETE' }),
};
