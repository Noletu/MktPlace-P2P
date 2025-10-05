import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// SECURITY: JWT_SECRET deve ser definido no .env com alta entropia
if (!process.env.JWT_SECRET) {
  throw new Error('SECURITY CRITICAL: JWT_SECRET must be set in environment variables');
}

// SECURITY: Validar comprimento mínimo de 64 caracteres para produção
const MIN_SECRET_LENGTH = process.env.NODE_ENV === 'production' ? 64 : 32;
if (process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `SECURITY CRITICAL: JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long in ${process.env.NODE_ENV} mode. ` +
    `Generate a secure secret with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
  );
}

// SECURITY: Validar que não é um placeholder ou valor padrão inseguro
const UNSAFE_SECRETS = ['<GERAR_SECRET_SEGURO_AQUI>', 'secret', 'mysecret', 'changeme', 'jwt_secret'];
if (UNSAFE_SECRETS.some(unsafe => process.env.JWT_SECRET?.toLowerCase().includes(unsafe.toLowerCase()))) {
  throw new Error(
    'SECURITY CRITICAL: JWT_SECRET contains unsafe placeholder. Generate a cryptographically secure secret.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

// SECURITY: Access token (curta duração)
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// SECURITY: Refresh token (longa duração)
export const generateRefreshToken = (userId: string, tokenId: string): string => {
  const payload: RefreshTokenPayload = {
    userId,
    tokenId,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
};

// SECURITY: Gerar token único para refresh token
export const generateTokenId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
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
