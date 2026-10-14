const API_BASE = '';

/**
 * Safely parse JSON or text from fetch response
 */
async function parseResponseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(parsed, res, defaultMsg) {
  if (parsed && typeof parsed === 'object') {
    return parsed.detail || parsed.message || parsed.error || defaultMsg;
  }
  if (typeof parsed === 'string' && parsed.length < 200 && !parsed.includes('<!DOCTYPE')) {
    return parsed;
  }
  return `${defaultMsg} (HTTP ${res.status})`;
}

const api = {
  get: async (endpoint) => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) {
        console.warn(`Error fetching ${endpoint}: HTTP ${res.status}`);
        return [];
      }
      const data = await parseResponseBody(res);
      return Array.isArray(data) || (data && typeof data === 'object') ? data : [];
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      return []; 
    }
  },

  post: async (endpoint, data) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const parsed = await parseResponseBody(res);
    if (!res.ok) {
      throw new Error(extractErrorMessage(parsed, res, 'Failed to save data'));
    }
    return parsed || {};
  },

  put: async (endpoint, data) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const parsed = await parseResponseBody(res);
    if (!res.ok) {
      throw new Error(extractErrorMessage(parsed, res, 'Failed to update data'));
    }
    return parsed || {};
  },

  delete: async (endpoint) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
    });
    const parsed = await parseResponseBody(res);
    if (!res.ok) {
      throw new Error(extractErrorMessage(parsed, res, 'Failed to delete data'));
    }
    return parsed || {};
  }
};

export default api;