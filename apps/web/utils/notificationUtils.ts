/**
 * Utilities for handling notification URLs
 */

/**
 * Normaliza URLs antigas de notificações para o novo formato
 *
 * Transformações:
 * - /orders/{id}/chat -> /orders/{id}?tab=chat
 *
 * @param url - URL original da notificação
 * @returns URL normalizada
 */
export function normalizeNotificationUrl(url: string): string {
  if (!url) return url;

  // Transformar URLs antigas de chat (/orders/{id}/chat -> /orders/{id}?tab=chat)
  if (url.match(/\/orders\/[^\/]+\/chat$/)) {
    return url.replace(/\/chat$/, '?tab=chat');
  }

  // Retornar URL sem transformação se não corresponder a nenhum padrão
  return url;
}
