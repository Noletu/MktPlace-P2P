import {prisma} from '../utils/prisma';

/**
 * Service para gerenciar estado persistente de workers
 */
export class WorkerStateService {
  /**
   * Obter estado de um worker
   */
  static async getState(workerName: string): Promise<boolean> {
    const state = await prisma.workerState.findUnique({
      where: {workerName},
    });

    return state?.isEnabled ?? false; // Default: desabilitado
  }

  /**
   * Salvar estado de um worker
   */
  static async setState(workerName: string, isEnabled: boolean): Promise<void> {
    const now = new Date();

    await prisma.workerState.upsert({
      where: {workerName},
      create: {
        workerName,
        isEnabled,
        lastStartedAt: isEnabled ? now : null,
        lastStoppedAt: isEnabled ? null : now,
      },
      update: {
        isEnabled,
        lastStartedAt: isEnabled ? now : undefined,
        lastStoppedAt: isEnabled ? undefined : now,
      },
    });
  }

  /**
   * Obter todos os estados de workers
   */
  static async getAllStates() {
    return await prisma.workerState.findMany({
      orderBy: {workerName: 'asc'},
    });
  }
}
