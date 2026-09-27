// ========================================================================
// API Client (Typed HTTP Client with Security Headers)
// ========================================================================

const rawApiUrl = (import.meta as any).env?.VITE_API_URL?.trim();
const API_BASE_URL = rawApiUrl ? `${rawApiUrl.replace(/\/$/, '')}/api/v1` : '/api/v1';

let authToken: string | null = localStorage.getItem('sms_auth_token');
let activeBranchId: string | null = localStorage.getItem('sms_active_branch_id');

export function setApiAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('sms_auth_token', token);
  } else {
    localStorage.removeItem('sms_auth_token');
  }
}

export function getApiAuthToken(): string | null {
  return authToken;
}

export function setApiActiveBranchId(branchId: string | null) {
  activeBranchId = branchId;
  if (branchId) {
    localStorage.setItem('sms_active_branch_id', branchId);
  } else {
    localStorage.removeItem('sms_active_branch_id');
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (activeBranchId) {
    headers.set('x-branch-id', activeBranchId);
  }

  // AbortController with 30 second timeout to prevent UI hanging indefinitely
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const config: RequestInit = {
    ...options,
    headers,
    signal: options.signal || controller.signal,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your network connection and try again.', 'REQUEST_TIMEOUT', 408);
    }
    throw new ApiError(err.message || 'Network connection error', 'NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    const errorMsg = data?.error?.message || response.statusText || 'An error occurred';
    const errorCode = data?.error?.code || `HTTP_${response.status}`;
    throw new ApiError(errorMsg, errorCode, response.status, data?.error?.details);
  }

  return data.data as T;
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, any>) => {
    let url = endpoint;
    if (params) {
      const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '');
      if (filtered.length > 0) {
        const query = new URLSearchParams(filtered as any).toString();
        url += `?${query}`;
      }
    }
    return request<T>(url, { method: 'GET' });
  },

  post: <T>(endpoint: string, body?: any) => {
    return request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put: <T>(endpoint: string, body?: any) => {
    return request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete: <T>(endpoint: string) => {
    return request<T>(endpoint, { method: 'DELETE' });
  },
};
