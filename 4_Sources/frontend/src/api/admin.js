const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.non_field_errors?.[0] || 'Ошибка запроса');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const adminAPI = {
  getUsers: (page = 1) => request(`/users/?page=${page}`),
  getEvents: () => request('/admin/events/'),
  sendBroadcast: (payload) => request('/admin/email/broadcast/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};
