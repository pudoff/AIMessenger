import { request } from './client';

export const adminAPI = {
  getUsers: (page = 1) => request(`/users/?page=${page}`),
  getEvents: () => request('/admin/events/'),
  sendBroadcast: (payload) => request('/admin/email/broadcast/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};
