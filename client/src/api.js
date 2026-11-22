// Frontdesk Centralized API Client

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getAuthToken() {
  return localStorage.getItem('frontdesk_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('frontdesk_token', token);
  } else {
    localStorage.removeItem('frontdesk_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Network request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getCurrentUser: () => request('/auth/me'),

  // Staff Tickets
  getStats: () => request('/tickets/stats'),
  getTickets: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/tickets${query ? `?${query}` : ''}`);
  },
  getTicket: (id) => request(`/tickets/${id}`),
  claimTicket: (id) => request(`/tickets/${id}/claim`, { method: 'POST' }),
  assignTicket: (id, agentId) => request(`/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify({ agentId }) }),
  updatePriority: (id, priority) => request(`/tickets/${id}/priority`, { method: 'PATCH', body: JSON.stringify({ priority }) }),
  updateStatus: (id, status) => request(`/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  sendMessage: (id, type, content) => request(`/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ type, content }) }),

  // Customer Portal
  getCustomerTickets: () => request('/customer/tickets'),
  getCustomerTicket: (id) => request(`/customer/tickets/${id}`),
  createCustomerTicket: (data) => request('/customer/tickets', { method: 'POST', body: JSON.stringify(data) }),
  customerReply: (id, content) => request(`/customer/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ content }) }),
  reopenTicket: (id, reason) => request(`/customer/tickets/${id}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Admin
  getAgents: () => request('/admin/agents'),
  createAgent: (data) => request('/admin/agents', { method: 'POST', body: JSON.stringify(data) }),
  getHolidays: () => request('/admin/holidays'),
  addHoliday: (data) => request('/admin/holidays', { method: 'POST', body: JSON.stringify(data) }),
  deleteHoliday: (id) => request(`/admin/holidays/${id}`, { method: 'DELETE' }),
  getSettings: () => request('/admin/settings'),
  updateSettings: (data) => request('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },
  getSlaReports: () => request('/admin/sla-reports'),
};
