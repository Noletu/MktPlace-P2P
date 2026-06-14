/**
 * SER-31: fonte única da whitelist de origins, compartilhada entre o CORS HTTP
 * (index.ts) e o CORS do Socket.IO (socket.server.ts). Antes, o socket derivava
 * a whitelist de NODE_ENV — divergente do HTTP. Lazy (lê process.env na chamada)
 * para não depender da ordem de carga do dotenv.
 */
export function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
}
