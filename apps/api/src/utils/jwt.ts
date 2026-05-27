import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// SECURITY (SER-13): Dois secrets distintos — token confusion impossível entre access e refresh
const SECRET_MIN_LENGTH = process.env.NODE_ENV === 'production' ? 64 : 32;

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error('SECURITY CRITICAL: JWT_ACCESS_SECRET must be set in environment variables');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('SECURITY CRITICAL: JWT_REFRESH_SECRET must be set in environment variables');
}
if (process.env.JWT_ACCESS_SECRET.length < SECRET_MIN_LENGTH) {
  throw new Error(
    `SECURITY CRITICAL: JWT_ACCESS_SECRET must be at least ${SECRET_MIN_LENGTH} characters in ${process.env.NODE_ENV} mode. ` +
    `Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
  );
}
if (process.env.JWT_REFRESH_SECRET.length < SECRET_MIN_LENGTH) {
  throw new Error(
    `SECURITY CRITICAL: JWT_REFRESH_SECRET must be at least ${SECRET_MIN_LENGTH} characters in ${process.env.NODE_ENV} mode. ` +
    `Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
  );
}
// SECURITY (SER-13): Access === Refresh permite que um refresh token seja aceito como access token
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    'SECURITY CRITICAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different. ' +
    'Shared secret enables token confusion attacks.'
  );
}

const UNSAFE_PREFIXES = ['secret', 'mysecret', 'changeme', 'jwt_secret', 'gerar_', 'test-'];
function assertNotUnsafe(value: string, name: string): void {
  if (UNSAFE_PREFIXES.some(u => value.toLowerCase().includes(u))) {
    throw new Error(`SECURITY CRITICAL: ${name} contains an unsafe placeholder value.`);
  }
}
assertNotUnsafe(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
assertNotUnsafe(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');

const JWT_ACCESS_SECRET: string = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// SECURITY (SER-13): Issuer e audiences explícitos — cruzamento de tokens rejeitado em verify
const JWT_ISSUER = 'mktplace.liberdade';
const JWT_AUDIENCE_HTTP = 'mktplace.liberdade.users';
const JWT_AUDIENCE_SOCKET = 'mktplace:socket';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
  jti?: string; // SECURITY (H-2): JWT ID para blacklist de revogação
  level?: number;
  accountFrozen?: boolean;
  frozenReason?: string | null;
  frozenUntil?: Date | null;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export interface SocketTicketPayload {
  userId: string;
  email: string;
  role: string;
}

// SECURITY (SER-13): Access token — JWT_ACCESS_SECRET + HTTP audience + HS256
export const generateToken = (payload: JWTPayload): string => {
  const jti = crypto.randomUUID();
  // @ts-expect-error - jsonwebtoken types issue with expiresIn
  return jwt.sign({ ...payload, jti }, JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE_HTTP,
  });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_HTTP,
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// SECURITY (SER-13): Refresh token — JWT_REFRESH_SECRET + HTTP audience + HS256
// Secret diferente impede que um refresh token seja aceito por verifyToken e vice-versa
export const generateRefreshToken = (userId: string, tokenId: string): string => {
  const payload: RefreshTokenPayload = { userId, tokenId };
  // @ts-expect-error - jsonwebtoken types issue with expiresIn
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE_HTTP,
  });
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_HTTP,
    }) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

export const generateTokenId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// SECURITY (SER-13): Socket ticket — JWT_ACCESS_SECRET + SOCKET audience isolada, TTL 60s
// Audience distinta: um access token HTTP é rejeitado por verifySocketTicket e vice-versa
export const signSocketTicket = (payload: SocketTicketPayload): string => {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '60s',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE_SOCKET,
  });
};

export const verifySocketTicket = (token: string): SocketTicketPayload => {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_SOCKET,
    }) as SocketTicketPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired socket ticket');
  }
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};
