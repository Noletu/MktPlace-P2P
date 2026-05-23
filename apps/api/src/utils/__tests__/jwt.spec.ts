import jwtLib from 'jsonwebtoken';
import {
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  signSocketTicket,
  verifySocketTicket,
} from '../jwt';

// Env vars set in setup.ts:
//   JWT_ACCESS_SECRET = 'a1'.repeat(32)  (64 chars)
//   JWT_REFRESH_SECRET = 'b2'.repeat(32) (64 chars, different)

const ACCESS_PAYLOAD = { userId: 'u1', email: 'u@test.com', role: 'USER' };

// ─── ROUND-TRIP ─────────────────────────────────────────────────────────────

describe('Round-trip (happy path)', () => {
  it('5. generateToken → verifyToken: payload + jti preservados', () => {
    const token = generateToken(ACCESS_PAYLOAD);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded.email).toBe('u@test.com');
    expect(decoded.role).toBe('USER');
    expect(typeof decoded.jti).toBe('string');
    expect(decoded.jti!.length).toBeGreaterThan(0);
  });

  it('6. generateRefreshToken → verifyRefreshToken: payload preservado', () => {
    const token = generateRefreshToken('u1', 'tok-abc');
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded.tokenId).toBe('tok-abc');
  });

  it('7. signSocketTicket → verifySocketTicket: payload preservado', () => {
    const ticket = signSocketTicket({ userId: 'u1', email: 'u@test.com', role: 'USER' });
    const decoded = verifySocketTicket(ticket);
    expect(decoded.userId).toBe('u1');
    expect(decoded.email).toBe('u@test.com');
    expect(decoded.role).toBe('USER');
  });
});

// ─── ISOLAMENTO DE AUDIENCE / SECRET ────────────────────────────────────────

describe('Audience isolation', () => {
  it('1. verifyToken rejeita socket ticket (audience mktplace:socket ≠ HTTP)', () => {
    const ticket = signSocketTicket({ userId: 'u1', email: 'u@test.com', role: 'USER' });
    expect(() => verifyToken(ticket)).toThrow('Invalid or expired token');
  });

  it('2. verifySocketTicket rejeita access token (audience HTTP ≠ mktplace:socket)', () => {
    const token = generateToken(ACCESS_PAYLOAD);
    expect(() => verifySocketTicket(token)).toThrow('Invalid or expired socket ticket');
  });

  it('3. verifyRefreshToken rejeita access token (JWT_ACCESS_SECRET ≠ JWT_REFRESH_SECRET)', () => {
    const token = generateToken(ACCESS_PAYLOAD);
    expect(() => verifyRefreshToken(token)).toThrow('Invalid or expired refresh token');
  });

  it('4. verifyToken rejeita refresh token (JWT_REFRESH_SECRET ≠ JWT_ACCESS_SECRET)', () => {
    const refreshToken = generateRefreshToken('u1', 'tok-abc');
    expect(() => verifyToken(refreshToken)).toThrow('Invalid or expired token');
  });
});

// ─── CONTRATO: ISSUER E ALGORITMO ────────────────────────────────────────────

describe('Contract validation', () => {
  it('8. verifyToken rejeita token com issuer errado', () => {
    const forged = jwtLib.sign(
      { userId: 'u1', email: 'u@test.com', role: 'USER' },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        issuer: 'evil.corp',
        audience: 'mktplace.liberdade.users',
      }
    );
    expect(() => verifyToken(forged)).toThrow('Invalid or expired token');
  });

  it('9. verifyToken rejeita token assinado com HS512 (algoritmo ≠ HS256)', () => {
    // Forja token com secret correto mas algoritmo diferente
    // @ts-expect-error — HS512 é string válida mas fora do union type restrito
    const forged = jwtLib.sign(
      { userId: 'u1', email: 'u@test.com', role: 'USER' },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS512',
        issuer: 'mktplace.liberdade',
        audience: 'mktplace.liberdade.users',
      }
    );
    expect(() => verifyToken(forged)).toThrow('Invalid or expired token');
  });
});

// ─── STARTUP GUARDS ──────────────────────────────────────────────────────────

describe('Startup guards', () => {
  const savedAccess = process.env.JWT_ACCESS_SECRET;
  const savedRefresh = process.env.JWT_REFRESH_SECRET;

  afterEach(() => {
    process.env.JWT_ACCESS_SECRET = savedAccess;
    process.env.JWT_REFRESH_SECRET = savedRefresh;
  });

  it('10. lança se JWT_ACCESS_SECRET === JWT_REFRESH_SECRET', () => {
    process.env.JWT_ACCESS_SECRET = 'z9'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'z9'.repeat(32); // idêntico ao access

    let caught: Error | undefined;
    jest.isolateModules(() => {
      try {
        require('../jwt');
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(caught?.message).toContain('must be different');
  });

  it('11. lança se JWT_ACCESS_SECRET é menor que o mínimo', () => {
    process.env.JWT_ACCESS_SECRET = 'z9'.repeat(10); // 20 chars < 32 mínimo (env test)
    process.env.JWT_REFRESH_SECRET = 'z8'.repeat(32);

    let caught: Error | undefined;
    jest.isolateModules(() => {
      try {
        require('../jwt');
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(caught?.message).toContain('JWT_ACCESS_SECRET must be at least');
  });
});
