import { Router } from 'express';
import { SupportController } from '../controllers/support.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { managerMiddleware } from '../middleware/manager.middleware';
import { supportMiddleware } from '../middleware/support.middleware';
import { disputeLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// ============================================
// ROTAS PÚBLICAS (autenticadas)
// ============================================

/**
 * POST /api/v1/support
 * Criar novo ticket de suporte
 * Permissão: Qualquer usuário autenticado
 * Rate limit: disputeLimiter (prevenir spam)
 */
router.post('/', disputeLimiter, SupportController.createTicket);

/**
 * GET /api/v1/support/my-tickets
 * Listar meus tickets
 * Permissão: Qualquer usuário autenticado
 * Query params: ?status=OPEN&category=ACCOUNT_ISSUE&priority=URGENT&limit=50&offset=0
 */
router.get('/my-tickets', SupportController.getMyTickets);

// ============================================
// ROTAS SUPPORT+ (level >= 40)
// ============================================

/**
 * GET /api/v1/support/stats
 * Estatísticas de tickets
 * Permissão: SUPPORT, GERENTE, ADMIN, MASTER (level >= 40)
 * IMPORTANTE: Deve vir ANTES de /:ticketId para não ser capturado
 */
router.get('/stats', supportMiddleware, SupportController.getTicketStats);

/**
 * GET /api/v1/support/:ticketId
 * Buscar ticket específico
 * Permissão: Criador do ticket OU suporte (level >= 40)
 */
router.get('/:ticketId', SupportController.getTicket);

/**
 * POST /api/v1/support/:ticketId/messages
 * Adicionar mensagem ao ticket
 * Permissão: Criador do ticket OU suporte (level >= 40)
 */
router.post('/:ticketId/messages', SupportController.addMessage);

/**
 * GET /api/v1/support
 * Listar todos os tickets (painel de suporte)
 * Permissão: SUPPORT, GERENTE, ADMIN, MASTER (level >= 40)
 * Query params: ?status=OPEN&category=ACCOUNT_ISSUE&priority=URGENT&limit=100&offset=0
 *
 * IMPORTANTE: Esta rota deve vir por último para não conflitar com outras rotas GET
 */
router.get('/', supportMiddleware, SupportController.getAllTickets);

// ============================================
// ROTAS MANAGER+ (level >= 60)
// ============================================

/**
 * POST /api/v1/support/:ticketId/resolve
 * Resolver ticket
 * Permissão: MANAGER, ADMIN, MASTER (level >= 60)
 */
router.post('/:ticketId/resolve', managerMiddleware, SupportController.resolveTicket);

export default router;
