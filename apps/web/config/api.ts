/**
 * Configuração centralizada da API
 * Este arquivo garante que a URL da API seja consistente em toda a aplicação
 */

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  // Extrair base URL sem /api/v1 para WebSocket
  wsBaseUrl: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace(/\/api\/v1$/, ''),
} as const;

/**
 * Helper para construir URLs da API
 */
export function getApiUrl(endpoint: string): string {
  // Remove barra inicial se existir
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_CONFIG.baseUrl}/${cleanEndpoint}`;
}

/**
 * Helper para construir URLs do WebSocket
 * @param namespace - Namespace do Socket.IO (ex: 'notifications', 'chat')
 */
export function getWsUrl(namespace: string): string {
  const cleanNamespace = namespace.startsWith('/') ? namespace.slice(1) : namespace;
  return `${API_CONFIG.wsBaseUrl}/${cleanNamespace}`;
}
