import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

export interface RecaptchaRequest extends Request {
  recaptchaVerified?: boolean;
}

// SECURITY: Middleware para verificar reCAPTCHA
export const recaptchaMiddleware = async (
  req: RecaptchaRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // SECURITY: Se RECAPTCHA_SECRET_KEY não estiver configurado, pular verificação em dev
  if (!RECAPTCHA_SECRET_KEY) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] RECAPTCHA_SECRET_KEY não configurado em produção!');
      res.status(500).json({
        success: false,
        error: 'Configuração de segurança inválida',
      });
      return;
    }

    console.warn('[SECURITY] RECAPTCHA_SECRET_KEY não configurado - pulando verificação');
    req.recaptchaVerified = true;
    next();
    return;
  }

  try {
    const recaptchaToken = req.body.recaptchaToken;

    if (!recaptchaToken) {
      res.status(400).json({
        success: false,
        error: 'Token reCAPTCHA não fornecido',
      });
      return;
    }

    // SECURITY: Verificar token com Google reCAPTCHA API
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await axios.post(verificationUrl, null, {
      params: {
        secret: RECAPTCHA_SECRET_KEY,
        response: recaptchaToken,
        remoteip: req.ip,
      },
    });

    const { success, score, action } = response.data;

    // SECURITY: Para reCAPTCHA v3, verificar score (0.0 a 1.0, quanto maior melhor)
    if (score !== undefined) {
      const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
      
      if (!success || score < minScore) {
        console.warn('[SECURITY] reCAPTCHA failed:', {
          success,
          score,
          action,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          error: 'Verificação reCAPTCHA falhou. Por favor, tente novamente.',
        });
        return;
      }
    } else {
      // SECURITY: Para reCAPTCHA v2, apenas verificar success
      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Verificação reCAPTCHA falhou. Por favor, tente novamente.',
        });
        return;
      }
    }

    req.recaptchaVerified = true;
    next();
  } catch (error: any) {
    console.error('[SECURITY] reCAPTCHA verification error:', error.message);

    res.status(500).json({
      success: false,
      error: 'Erro na verificação de segurança',
    });
  }
};

// SECURITY: Middleware opcional (não bloqueia se falhar)
export const optionalRecaptchaMiddleware = async (
  req: RecaptchaRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!RECAPTCHA_SECRET_KEY || !req.body.recaptchaToken) {
    req.recaptchaVerified = false;
    next();
    return;
  }

  try {
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await axios.post(verificationUrl, null, {
      params: {
        secret: RECAPTCHA_SECRET_KEY,
        response: req.body.recaptchaToken,
        remoteip: req.ip,
      },
    });

    req.recaptchaVerified = response.data.success;
  } catch (error) {
    req.recaptchaVerified = false;
  }

  next();
};
