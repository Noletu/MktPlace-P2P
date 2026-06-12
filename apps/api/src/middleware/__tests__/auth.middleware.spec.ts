import { isFrozenActionAllowed } from '../auth.middleware';

describe('SER-33 — isFrozenActionAllowed (allowlist de conta congelada)', () => {
  describe('leitura (sempre permitida)', () => {
    it('permite GET em qualquer rota', () => {
      expect(isFrozenActionAllowed('GET', '/api/v1/orders')).toBe(true);
      expect(isFrozenActionAllowed('GET', '/api/v1/admin/funds/frozen-accounts')).toBe(true);
      expect(isFrozenActionAllowed('GET', '/api/v1/wallets/abc/balance')).toBe(true);
    });
    it('permite HEAD e OPTIONS', () => {
      expect(isFrozenActionAllowed('HEAD', '/api/v1/orders')).toBe(true);
      expect(isFrozenActionAllowed('OPTIONS', '/api/v1/orders')).toBe(true);
    });
  });

  describe('apelação / defesa em disputa (permitida)', () => {
    it('permite criar disputa (com e sem barra final)', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/disputes')).toBe(true);
      expect(isFrozenActionAllowed('POST', '/api/v1/disputes/')).toBe(true);
    });
    it('permite mensagem e respond na disputa', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/disputes/abc123/messages')).toBe(true);
      expect(isFrozenActionAllowed('POST', '/api/v1/disputes/abc123/respond')).toBe(true);
    });
  });

  describe('notificações próprias (permitidas)', () => {
    it('permite marcar lida, mark-all-read e deletar', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/notifications/abc/read')).toBe(true);
      expect(isFrozenActionAllowed('POST', '/api/v1/notifications/mark-all-read')).toBe(true);
      expect(isFrozenActionAllowed('DELETE', '/api/v1/notifications/abc')).toBe(true);
      expect(isFrozenActionAllowed('DELETE', '/api/v1/notifications/delete-all-read')).toBe(true);
    });
  });

  describe('sessão (permitida)', () => {
    it('permite logout', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/auth/logout')).toBe(true);
    });
  });

  describe('ações privilegiadas / financeiras (BLOQUEADAS — o coração do fix)', () => {
    it('bloqueia criar order e sacar', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/orders')).toBe(false);
      expect(isFrozenActionAllowed('POST', '/api/v1/wallets/abc/withdraw')).toBe(false);
    });
    it('bloqueia resolver disputa (move colateral)', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/disputes/abc/resolve')).toBe(false);
    });
    it('bloqueia broadcasts admin de notificação', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/notifications/broadcast')).toBe(false);
      expect(isFrozenActionAllowed('POST', '/api/v1/notifications/system-announcement')).toBe(false);
      expect(isFrozenActionAllowed('POST', '/api/v1/notifications/admin-broadcast')).toBe(false);
    });
    it('bloqueia freeze/unfreeze', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/admin/funds/freeze')).toBe(false);
      expect(isFrozenActionAllowed('POST', '/api/v1/admin/funds/unfreeze')).toBe(false);
    });
    it('bloqueia mutações de auth fora do logout', () => {
      expect(isFrozenActionAllowed('PUT', '/api/v1/auth/profile')).toBe(false);
      expect(isFrozenActionAllowed('PUT', '/api/v1/auth/notification-preferences')).toBe(false);
    });
  });

  describe('fragilidade de substring eliminada (regressão)', () => {
    it('NÃO libera rota que apenas CONTÉM um termo do allowlist', () => {
      expect(isFrozenActionAllowed('POST', '/api/v1/wallets/disputes/withdraw')).toBe(false);
      expect(isFrozenActionAllowed('POST', '/api/v1/orders/notifications/create')).toBe(false);
    });
    it('método errado não passa mesmo em path permitido', () => {
      expect(isFrozenActionAllowed('DELETE', '/api/v1/disputes')).toBe(false);
      expect(isFrozenActionAllowed('PUT', '/api/v1/disputes/abc/messages')).toBe(false);
    });
  });
});
