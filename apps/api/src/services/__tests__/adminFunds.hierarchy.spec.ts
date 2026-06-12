// Stubs para módulos ESM transitivos (mesmo padrão de wallet.crit04.spec.ts)
jest.mock('../hd-wallet/derivation.service', () => ({ DerivationService: {} }));
jest.mock('../hd-wallet/key-management.service', () => ({ KeyManagementService: {} }));
jest.mock('../blockchain/blockchain.service', () => ({ BlockchainService: {} }));
jest.mock('../blockchain/fee-estimator.service', () => ({ FeeEstimatorService: {} }));
jest.mock('../email.service', () => ({ emailService: { sendEmail: jest.fn() } }));

import { getEffectiveLevel, canFreezeTarget } from '../adminFunds.service';

describe('SER-41 — getEffectiveLevel (nível efetivo com fallback de papel antigo)', () => {
  it('usa role.level do RBAC novo quando presente (ignora legacyRole)', () => {
    expect(getEffectiveLevel({ role: { level: 100 }, legacyRole: 'USER' })).toBe(100);
    expect(getEffectiveLevel({ role: { level: 60 }, legacyRole: 'ADMIN' })).toBe(60);
  });

  it('respeita role.level === 0 (USER com relation) sem cair no fallback', () => {
    expect(getEffectiveLevel({ role: { level: 0 }, legacyRole: 'MASTER' })).toBe(0);
  });

  it('cai no legacyRole quando não há role relation', () => {
    expect(getEffectiveLevel({ role: null, legacyRole: 'MASTER' })).toBe(100);
    expect(getEffectiveLevel({ role: null, legacyRole: 'ADMIN' })).toBe(80);
    expect(getEffectiveLevel({ role: null, legacyRole: 'GERENTE' })).toBe(60);
    expect(getEffectiveLevel({ role: null, legacyRole: 'SUPPORT' })).toBe(40);
    expect(getEffectiveLevel({ role: null, legacyRole: 'USER' })).toBe(0);
  });

  it('normaliza a caixa do legacyRole', () => {
    expect(getEffectiveLevel({ role: null, legacyRole: 'master' })).toBe(100);
    expect(getEffectiveLevel({ legacyRole: 'Admin' })).toBe(80);
  });

  it('retorna 0 para papel desconhecido ou ausente', () => {
    expect(getEffectiveLevel({ role: null, legacyRole: 'XPTO' })).toBe(0);
    expect(getEffectiveLevel({ role: null, legacyRole: null })).toBe(0);
    expect(getEffectiveLevel({})).toBe(0);
  });
});

describe('SER-41 — canFreezeTarget (hierarquia: só congela nível inferior)', () => {
  const A = 'admin-id';
  const B = 'target-id';

  it('bloqueia auto-freeze mesmo com níveis distintos', () => {
    const r = canFreezeTarget({ adminUserId: A, targetUserId: A, adminLevel: 100, targetLevel: 0 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/própria conta/i);
  });

  it('permite congelar nível estritamente inferior', () => {
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 60, targetLevel: 0 }).allowed).toBe(true);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 60, targetLevel: 40 }).allowed).toBe(true);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 80, targetLevel: 60 }).allowed).toBe(true);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 100, targetLevel: 80 }).allowed).toBe(true);
  });

  it('bloqueia congelar nível IGUAL (pares)', () => {
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 60, targetLevel: 60 }).allowed).toBe(false);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 100, targetLevel: 100 }).allowed).toBe(false);
  });

  it('bloqueia congelar nível SUPERIOR (inversão de autoridade)', () => {
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 60, targetLevel: 80 }).allowed).toBe(false);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 60, targetLevel: 100 }).allowed).toBe(false);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 80, targetLevel: 100 }).allowed).toBe(false);
  });

  it('o MASTER (topo) nunca é congelável', () => {
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 60, targetLevel: 100 }).allowed).toBe(false);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 80, targetLevel: 100 }).allowed).toBe(false);
    expect(canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 100, targetLevel: 100 }).allowed).toBe(false);
  });

  it('negação sempre traz uma reason não-vazia', () => {
    const r = canFreezeTarget({ adminUserId: A, targetUserId: B, adminLevel: 60, targetLevel: 80 });
    expect(r.allowed).toBe(false);
    expect((r.reason || '').length).toBeGreaterThan(0);
  });
});
