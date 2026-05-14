/**
 * Collateral Service (ADAPTER)
 *
 * MIGRADO: Este service agora é um ADAPTER que usa HD Wallet System.
 * Em vez de gerar endereços temporários (CollateralAddress deprecado),
 * agora retorna endereços de carteiras HD permanentes.
 *
 * Mantém compatibilidade com código legado.
 */

import { WalletService } from './wallet.service';
import { internalBalanceService } from './internal-balance.service';
import { toBN, addBN } from '../utils/money';

export class CollateralService {
  /**
   * Gerar endereço de colateral (adapter - retorna carteira HD)
   *
   * NOTA: No sistema antigo, cada pedido gerava um endereço único.
   * No sistema HD Wallet, usamos a carteira permanente do usuário.
   */
  async generateCollateralAddress(
    userId: string,
    cryptoType: string,
    network: string,
    expectedAmount: string
  ) {
    // Buscar ou criar carteira HD para o usuário
    let wallet = await WalletService.getWalletByUserAndCrypto(userId, cryptoType, network);

    if (!wallet) {
      // Criar nova carteira HD
      wallet = await WalletService.createWallet(userId, cryptoType, network, {
        source: 'COLLATERAL_GENERATE',
        details: { endpoint: 'POST /collateral/generate', trigger: 'collateral_address' },
      });
    }

    // Retornar no formato antigo para compatibilidade
    return {
      id: wallet.id,
      userId: wallet.userId,
      cryptoType: wallet.cryptoType,
      cryptoNetwork: wallet.network,
      address: wallet.address,
      expectedAmount: expectedAmount,
      actualAmount: null,
      status: 'AWAITING_PAYMENT', // Simula estado antigo
      txHash: null,
      createdAt: wallet.createdAt,
      confirmedAt: null,
      // Campos adicionais para compatibilidade
      qrCode: `${network}:${wallet.address}?amount=${expectedAmount}`,
    };
  }

  /**
   * Buscar endereços de colateral do usuário (adapter)
   */
  async getUserCollateralAddresses(userId: string) {
    // Retornar todas as carteiras HD como "endereços de colateral"
    const wallets = await WalletService.getUserWallets(userId);

    return wallets.map(w => ({
      id: w.id,
      userId: w.userId,
      cryptoType: w.cryptoType,
      cryptoNetwork: w.network,
      address: w.address,
      expectedAmount: '0', // Sem valor esperado fixo
      actualAmount: w.balance,
      status: 'CONFIRMED', // Carteiras HD estão sempre "confirmadas"
      txHash: null,
      createdAt: w.createdAt,
      confirmedAt: w.createdAt,
    }));
  }

  /**
   * Buscar endereço específico (adapter)
   */
  async getCollateralAddress(addressId: string) {
    try {
      const wallet = await WalletService.getWallet(addressId);

      return {
        id: wallet.id,
        userId: wallet.userId,
        cryptoType: wallet.cryptoType,
        cryptoNetwork: wallet.network,
        address: wallet.address,
        expectedAmount: '0',
        actualAmount: wallet.balance,
        status: 'CONFIRMED',
        txHash: null,
        createdAt: wallet.createdAt,
        confirmedAt: wallet.createdAt,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Verificar saldo suficiente (adapter)
   */
  async checkSufficientBalance(
    userId: string,
    cryptoType: string,
    network: string,
    requiredAmount: string
  ): Promise<boolean> {
    const available = await internalBalanceService.getAvailableBalance(
      userId,
      cryptoType,
      network
    );

    return available >= toBN(requiredAmount).toNumber();
  }

  /**
   * Bloquear colateral para pedido (adapter)
   */
  async lockCollateral(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    orderId: string
  ) {
    await internalBalanceService.lockBalance(
      userId,
      cryptoType,
      network,
      amount,
      orderId
    );

    return {
      success: true,
      message: `Collateral locked: ${amount} ${cryptoType}`,
    };
  }

  /**
   * Liberar colateral (adapter)
   */
  async releaseCollateral(
    userId: string,
    cryptoType: string,
    network: string,
    amount: string,
    orderId: string
  ) {
    await internalBalanceService.unlockBalance(
      userId,
      cryptoType,
      network,
      amount,
      orderId
    );

    return {
      success: true,
      message: `Collateral released: ${amount} ${cryptoType}`,
    };
  }

  /**
   * Verificar pagamento de colateral (adapter)
   */
  async checkCollateralPayment(addressId: string) {
    // No sistema HD Wallet, usamos WalletService para verificar saldo
    const wallet = await WalletService.getWallet(addressId);

    if (!wallet) {
      return {
        paid: false,
        actualAmount: '0',
        status: 'NOT_FOUND',
      };
    }

    // Verificar se há saldo na carteira
    const balance = toBN(wallet.balance).toNumber();

    return {
      paid: balance > 0,
      actualAmount: wallet.balance,
      status: balance > 0 ? 'CONFIRMED' : 'AWAITING_PAYMENT',
      address: wallet.address,
      txHash: null, // Não rastreamos TX específica aqui
    };
  }

  /**
   * Simular pagamento recebido (adapter - apenas para testes)
   */
  async simulatePaymentReceived(
    addressId: string,
    amount: string,
    txHash?: string
  ) {
    const wallet = await WalletService.getWallet(addressId);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Creditar saldo via ledger interno (produção-safe)
    await WalletService.creditBalance(wallet.id, amount, `Collateral payment: ${txHash || 'simulated'}`);

    return {
      success: true,
      message: `Payment simulated: ${amount} ${wallet.cryptoType}`,
      address: wallet.address,
      newBalance: toBN(addBN(wallet.balance, amount)).toFixed(8),
    };
  }
}

export const collateralService = new CollateralService();
