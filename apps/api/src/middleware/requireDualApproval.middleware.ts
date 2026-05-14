import { Request, Response } from 'express';
import { PendingApprovalService } from '../services/pendingApproval.service';

/**
 * Middleware terminal que intercepta operações críticas e cria um PendingApproval
 * ao invés de executar imediatamente.
 *
 * Retorna 202 Accepted e NÃO chama next() — o controller original nunca é atingido via HTTP.
 * A operação será executada quando o segundo MASTER aprovar.
 *
 * Uso:
 *   router.post('/internal-transfer',
 *     financialOperationsMiddleware,
 *     require2FAMiddleware,
 *     financialOperationsLimiter,
 *     requireDualApproval('INTERNAL_TRANSFER'),
 *   );
 */
export function requireDualApproval(operationType: string) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const approval = await PendingApprovalService.create({
        initiatorId:      req.user!.userId,
        operationType,
        operationPayload: req.body,
        initiatorNote:    req.body.initiatorNote ?? undefined,
      });

      res.status(202).json({
        success: true,
        message: 'Operação enviada para aprovação dupla. Aguardando confirmação do segundo sócio MASTER.',
        data: approval,
      });
    } catch (err: any) {
      console.error(`[requireDualApproval] Error creating pending approval (${operationType}):`, err);
      res.status(500).json({
        success: false,
        error: err.message ?? 'Erro ao criar pedido de aprovação.',
      });
    }
    // NÃO chama next() — middleware terminal
  };
}
