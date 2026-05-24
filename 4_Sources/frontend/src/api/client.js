import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('auth_token');
const clearAuthToken = () => localStorage.removeItem('auth_token');

const buildHeaders = (options = {}) => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Token ${token}` }),
    ...options.headers,
  };
};

const parseResponse = async (response) => {
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export const request = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: buildHeaders(options),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
    }

    const error = new Error(
      data?.detail || data?.non_field_errors?.[0] || 'Ошибка запроса'
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const apiClient = {
  request,
  getAuthToken,
  clearAuthToken,
};
