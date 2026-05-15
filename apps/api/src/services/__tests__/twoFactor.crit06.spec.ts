// CRIT-06: backup codes 2FA precisam vir de CSPRNG, não Math.random.
//
// O método público generateBackupCodes() retorna códigos RAW (10 hex chars
// uppercase). O formato exibido XXXX-XXXX-XX é aplicado pelo caller via
// formatBackupCode. Os testes abaixo cobrem o contrato do gerador raw mais
// duas defesas explícitas: (a) padrão hex/uppercase, (b) Math.random NUNCA
// é chamado (spy assertivo).

import { TwoFactorService } from '../twoFactor.service';

describe('CRIT-06: generateBackupCodes via crypto.randomBytes', () => {
  const service = new TwoFactorService();

  it('cada código bate o padrão ^[0-9A-F]{10}$ (10 hex uppercase, sem hífen)', () => {
    const codes = service.generateBackupCodes(50);
    expect(codes).toHaveLength(50);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{10}$/);
    }
  });

  it('10.000 códigos consecutivos são todos únicos (colisão extremamente improvável)', () => {
    const codes = service.generateBackupCodes(10_000);
    const unique = new Set(codes);
    // 40 bits de entropia, 10k draws: P(colisão) ~ 10k^2 / 2^41 ≈ 4.5e-5 — aceitável.
    // Se cair em colisão aqui, alguém quebrou randomBytes ou bug no slice.
    expect(unique.size).toBe(10_000);
  });

  it('NÃO usa Math.random — spy garante zero chamadas', () => {
    const mathRandomSpy = jest.spyOn(Math, 'random');
    try {
      service.generateBackupCodes(100);
      expect(mathRandomSpy).not.toHaveBeenCalled();
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it('count default = 10', () => {
    const codes = service.generateBackupCodes();
    expect(codes).toHaveLength(10);
  });

  it('distribuição razoável de caracteres (sanity check anti-bias)', () => {
    // Gera muitos códigos e conta frequência por char. Não é teste estatístico
    // rigoroso — só pega o caso de "esqueci uma letra do alfabeto hex".
    const codes = service.generateBackupCodes(1000);
    const counts: Record<string, number> = {};
    for (const code of codes) {
      for (const ch of code) {
        counts[ch] = (counts[ch] ?? 0) + 1;
      }
    }
    // 16 chars hex, 10 chars/code, 1000 codes => 10000 chars total, esperado
    // ~625 por char. Tolerância ampla: aceita 250-1500 (qualquer char fora
    // dessa janela sinaliza bug de geração).
    for (const ch of '0123456789ABCDEF') {
      expect(counts[ch] ?? 0).toBeGreaterThan(250);
      expect(counts[ch] ?? 0).toBeLessThan(1500);
    }
  });
});
