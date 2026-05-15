/**
 * Internal Balance Service (ADAPTER)
 *
 * MIGRADO: Este service agora é um ADAPTER que traduz chamadas antigas
 * para o novo WalletService (HD Wallet System).
 *
 * Mantém compatibilidade com código legado sem quebrar a API existente.
 */

import { WalletService } from './wallet.service';
import { toBN } from '../utils/money';

export class InternalBalanceService {
  /**
   * Obter saldo interno do usuário (adapter para WalletService)
   */
  async getBalance(userId: string, cryptoType: string, network: string) {
    const wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      return null;
    }

    // Retornar no formato antigo para compatibilidade
    return {
      id: wallet.id,
      userId: wallet.userId,
      cryptoType: wallet.cryptoType,
      network: wallet.network,
      balance: wallet.balance,
      createdAt: wallet.createdAt,
      updatedAt: wallet.createdAt, // UserWallet não tem updatedAt
    };
  }

  /**
   * Obter todos os saldos do usuário (adapter)
   */
  async getAllBalances(userId: string) {
    const wallets = await WalletService.getUserWallets(userId);

    // Transformar para formato antigo
    return wallets.map(w => ({
      id: w.id,
      userId: w.userId,
      cryptoType: w.cryptoType,
      network: w.network,
      balance: w.balance,
      createdAt: w.createdAt,
      updatedAt: w.createdAt,
    }));
  }

  /**
   * Adicionar crédito ao saldo interno (adapter)
   */
  async addBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string
  ) {
    // Buscar ou criar carteira
    let wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      // Criar nova carteira HD
      wallet = await WalletService.createWallet(userId, cryptoType, network, {
        source: 'INTERNAL_BALANCE_ADD',
        details: { trigger: 'add_balance' },
      });
    }

    // Creditar saldo via ledger interno (produção-safe)
    await WalletService.creditBalance(wallet.id, amount, `Internal credit: ${cryptoType}`);

    console.log(`✅ Saldo interno creditado (via HD Wallet): ${userId} - ${amount} ${cryptoType}`);

    // Buscar wallet atualizado
    const updated = await WalletService.getWallet(wallet.id);

    return {
      id: updated.id,
      userId: updated.userId,
      cryptoType: updated.cryptoType,
      network: updated.network,
      balance: updated.balance,
      createdAt: updated.createdAt,
      updatedAt: updated.createdAt,
    };
  }

  /**
   * Deduzir do saldo interno (adapter - usa deductBalance do WalletService)
   */
  async deductBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string
  ) {
    const wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      throw new Error('Saldo interno não encontrado');
    }

    // Deduzir do saldo disponível
    await WalletService.deductBalance(wallet.id, amount, 'Deduction from internal balance', false);

    const updated = await WalletService.getWallet(wallet.id);

    return {
      id: updated.id,
      userId: updated.userId,
      cryptoType: updated.cryptoType,
      network: updated.network,
      balance: updated.balance,
      createdAt: updated.createdAt,
      updatedAt: updated.createdAt,
    };
  }

  /**
   * Obter saldo disponível (não bloqueado)
   */
  async getAvailableBalance(
    userId: string,
    cryptoType: string,
    network: string
  ): Promise<number> {
    const wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      return 0;
    }

    return toBN(wallet.availableBalance).toNumber();
  }

  /**
   * Bloquear saldo para ordem (adapter)
   */
  async lockBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    orderId: string
  ) {
    const wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    await WalletService.lockBalance(wallet.id, amount, orderId, `Collateral locked for order ${orderId}`);

    return { success: true };
  }

  /**
   * Desbloquear saldo (adapter)
   */
  async unlockBalance(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    orderId: string
  ) {
    const wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    await WalletService.unlockBalance(wallet.id, amount, orderId, `Collateral unlocked for order ${orderId}`);

    return { success: true };
  }

  /**
   * Creditar depósito (adapter)
   */
  async creditDeposit(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    txHash: string
  ) {
    // Criar ou buscar carteira
    let wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      wallet = await WalletService.createWallet(userId, cryptoType, network, {
        source: 'INTERNAL_BALANCE_CREDIT',
        details: { trigger: 'credit_deposit', txHash },
      });
    }

    // Creditar saldo via ledger interno (produção-safe)
    await WalletService.creditBalance(wallet.id, amount, `Deposit credit: ${txHash}`);

    console.log(`✅ Depósito creditado (via HD Wallet): ${amount} ${cryptoType} - TX: ${txHash}`);

    return { success: true };
  }
}

export const internalBalanceService = new InternalBalanceService();

// Tipos para compatibilidade
export type CollateralTransactionType =
  | 'DEPOSIT'
  | 'LOCK'
  | 'UNLOCK'
  | 'DEDUCT'
  | 'REFUND';
