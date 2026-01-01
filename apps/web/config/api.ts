/**
 * Configuração centralizada da API
 * Este arquivo garante que a URL da API seja consistente em toda a aplicação
 */

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
} as const;

/**
 * Helper para construir URLs da API
 */
export function getApiUrl(endpoint: string): string {
  // Remove barra inicial se existir
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_CONFIG.baseUrl}/${cleanEndpoint}`;
}
