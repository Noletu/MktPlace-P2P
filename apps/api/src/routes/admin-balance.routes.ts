/**
 * Rotas de Auditoria de Saldo Admin
 *
 * FINALIDADE:
 * - Endpoints protegidos para admins diagnosticarem/corrigirem saldos
 *
 * ROTAS:
 * GET  /api/v1/admin/balance/audit/:userId     - Auditar saldo de usuário
 * POST /api/v1/admin/balance/fix/:userId       - Forçar correção de saldo
 * GET  /api/v1/admin/balance/validate-all      - Validar todos os saldos
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { require2FAMiddleware } from '../middleware/require2FA.middleware';
import {
  auditUserBalance,
  fixUserBalance,
  validateAllBalances,
} from '../controllers/admin-balance.controller';

const router = express.Router();

// Todas as rotas requerem autenticação + permissão de admin
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/v1/admin/balance/audit/:userId - Auditar saldo de usuário
router.get('/audit/:userId', auditUserBalance);

// SECURITY: Correção forçada de saldo exige 2FA (altera dados financeiros diretamente)
router.post('/fix/:userId', require2FAMiddleware, fixUserBalance);

// GET /api/v1/admin/balance/validate-all - Validar todos os saldos
router.get('/validate-all', validateAllBalances);

export default router;
