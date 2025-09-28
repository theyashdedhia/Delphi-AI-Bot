// Central API client
// Usage: import { apiClient } from './client';
// apiClient.request('GET', '/delphi-vault-file');

const DEFAULT_BASE = 'https://c0nir0ve96.execute-api.ap-southeast-2.amazonaws.com/Development';

class ApiClient {
  constructor(baseUrl = DEFAULT_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  buildUrl(path = '', query) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${this.baseUrl}${cleanPath}`;
    if (query && Object.keys(query).length) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k,v]) => {
        if (v === undefined || v === null) return;
        params.append(k, String(v));
      });
      url += `?${params.toString()}`;
    }
    return url;
  }

  async request(method, path, { query, body, headers } = {}) {
    const url = this.buildUrl(path, query);
    const init = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers||{})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    const res = await fetch(url, init);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      const msg = json?.message || `Request failed (${res.status})`;
      const error = new Error(msg);
      error.status = res.status;
      error.payload = json;
      throw error;
    }
    return json;
  }
}

export const apiClient = new ApiClient();

// Helper for base64 upload preparation (can be reused by other modules)
export async function fileToBase64(file) {
  const arrayBuf = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    const chunk = bytes.subarray(i, i + 0x8000);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
