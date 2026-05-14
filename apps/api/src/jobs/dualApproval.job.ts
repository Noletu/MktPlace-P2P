import cron from 'node-cron';
import { PendingApprovalService } from '../services/pendingApproval.service';
import { MasterDelegationService } from '../services/masterDelegation.service';

export const startDualApprovalJob = (): void => {
  // Executa a cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    try {
      await PendingApprovalService.processExpirationsAndOverrides();
    } catch (err) {
      console.error('[DualApprovalJob] Error in processExpirationsAndOverrides:', err);
    }

    try {
      await MasterDelegationService.expireOldDelegations();
    } catch (err) {
      console.error('[DualApprovalJob] Error in expireOldDelegations:', err);
    }
  });

  console.log('[DualApproval Job] Started — runs every 5 minutes');
};
