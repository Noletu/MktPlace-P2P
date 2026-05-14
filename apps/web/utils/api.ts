/**
 * API utility functions for making authenticated requests
 */

import { API_CONFIG } from '@/config/api';

const API_BASE_URL = API_CONFIG.baseUrl;

/**
 * @deprecated Tokens não devem ser acessados via localStorage (XSS).
 * Use fetchWithAuth que envia o cookie HttpOnly automaticamente.
 * Mantido apenas para leitura de dados de usuário não-sensíveis durante migração.
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

/**
 * Make an authenticated fetch request.
 * SECURITY: Usa cookie HttpOnly (accessToken) via credentials:'include'.
 * Não envia Authorization header — o backend lê o cookie diretamente.
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Cookie HttpOnly enviado automaticamente pelo browser
  });
}

/**
 * Make a GET request with authentication
 */
export async function apiGet(endpoint: string): Promise<any> {
  const response = await fetchWithAuth(endpoint, { method: 'GET' });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a POST request with authentication
 */
export async function apiPost(endpoint: string, data: any): Promise<any> {
  const response = await fetchWithAuth(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a PUT request with authentication
 */
export async function apiPut(endpoint: string, data: any): Promise<any> {
  const response = await fetchWithAuth(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a DELETE request with authentication
 */
export async function apiDelete(endpoint: string): Promise<any> {
  const response = await fetchWithAuth(endpoint, {
    method: 'DELETE',
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a PATCH request with authentication
 */
export async function apiPatch(endpoint: string, data?: any): Promise<any> {
  const response = await fetchWithAuth(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
