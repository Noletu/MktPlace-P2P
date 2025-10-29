import { randomBytes } from 'crypto';
import { blockchainService } from './blockchain.service';
import { adminService } from './admin.service';
import { prisma } from '../utils/prisma';

export class CollateralService {
  /**
   * Gera endereço de depósito para colateral
   * Busca endereço ativo da plataforma no banco de dados
   */
  async generateCollateralAddress(
    userId: string,
    cryptoType: string,
    cryptoNetwork: string,
    expectedAmount: string
  ) {
    // Buscar endereço ativo da plataforma para esta cripto/rede
    const platformWallet = await adminService.getActivePlatformWallet(
      cryptoType,
      cryptoNetwork
    );

    if (!platformWallet) {
      throw new Error(
        `Nenhum endereço da plataforma ativo encontrado para ${cryptoType} na rede ${cryptoNetwork}. ` +
        `Por favor, configure um endereço da plataforma no painel de administração.`
      );
    }

    console.log(`✅ Usando endereço da plataforma: ${platformWallet.address}`);

    // Expira em 30 minutos
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const collateralAddress = await prisma.collateralAddress.create({
      data: {
        userId,
        cryptoType,
        cryptoNetwork,
        address: platformWallet.address,
        expectedAmount,
        status: 'AWAITING_PAYMENT',
        expiresAt,
      },
    });

    return collateralAddress;
  }


  /**
   * Verifica status do pagamento do colateral na blockchain
   */
  async checkCollateralPayment(collateralAddressId: string) {
    const collateralAddress = await prisma.collateralAddress.findUnique({
      where: { id: collateralAddressId },
    });

    if (!collateralAddress) {
      throw new Error('Endereço de colateral não encontrado');
    }

    // Se já foi confirmado, retornar status atual
    if (collateralAddress.status === 'CONFIRMED') {
      return collateralAddress;
    }

    // Verificar pagamento na blockchain
    const payment = await blockchainService.checkPayment(
      collateralAddress.address,
      collateralAddress.cryptoNetwork,
      collateralAddress.cryptoType,
      collateralAddress.expectedAmount
    );

    // Se recebeu pagamento, confirmar automaticamente
    if (payment.received && payment.txHash) {
      console.log(`✅ Pagamento confirmado! TxHash: ${payment.txHash}, Amount: ${payment.amount}`);

      return await this.confirmCollateralPayment(
        collateralAddressId,
        payment.txHash,
        payment.amount || collateralAddress.expectedAmount
      );
    }

    return collateralAddress;
  }

  /**
   * Marca colateral como confirmado (chamado após detectar pagamento on-chain)
   */
  async confirmCollateralPayment(
    collateralAddressId: string,
    txHash: string,
    actualAmount: string
  ) {
    const collateralAddress = await prisma.collateralAddress.update({
      where: { id: collateralAddressId },
      data: {
        status: 'CONFIRMED',
        txHash,
        actualAmount,
        confirmedAt: new Date(),
      },
    });

    console.log(`✅ Colateral confirmado: ${collateralAddressId}`);
    console.log(`   TxHash: ${txHash}`);
    console.log(`   Amount: ${actualAmount}`);

    return collateralAddress;
  }

  /**
   * Expira endereços de colateral antigos
   */
  async expireOldAddresses() {
    const now = new Date();

    await prisma.collateralAddress.updateMany({
      where: {
        status: 'AWAITING_PAYMENT',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  /**
   * Simula recebimento de pagamento (APENAS PARA DESENVOLVIMENTO)
   */
  async simulatePaymentReceived(collateralAddressId: string) {
    console.log('⚠️ SIMULANDO RECEBIMENTO DE PAGAMENTO (desenvolvimento)');

    const mockTxHash = `0x${randomBytes(32).toString('hex')}`;

    return await this.confirmCollateralPayment(
      collateralAddressId,
      mockTxHash,
      '1.0'
    );
  }

  /**
   * Valida formato de endereço crypto
   */
  private validateCryptoAddress(address: string, cryptoType: string, network: string): boolean {
    const patterns: Record<string, RegExp> = {
      'BTC-BITCOIN': /^([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/,
      'USDT-ETHEREUM': /^0x[a-fA-F0-9]{40}$/,
      'USDT-TRC20': /^T[a-zA-Z0-9]{33}$/,
      'USDT-BASE': /^0x[a-fA-F0-9]{40}$/,
      'USDT-ARBITRUM': /^0x[a-fA-F0-9]{40}$/,
      'USDT-SOLANA': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      'USDC-ETHEREUM': /^0x[a-fA-F0-9]{40}$/,
      'USDC-TRC20': /^T[a-zA-Z0-9]{33}$/,
      'USDC-BASE': /^0x[a-fA-F0-9]{40}$/,
      'USDC-ARBITRUM': /^0x[a-fA-F0-9]{40}$/,
      'USDC-SOLANA': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    };

    const key = `${cryptoType}-${network}`;
    const pattern = patterns[key];

    if (!pattern) {
      console.warn(`⚠️ Padrão de validação não encontrado para ${key}`);
      return false;
    }

    return pattern.test(address);
  }

  /**
   * Obtém limites de saque por cripto/rede
   */
  private getWithdrawalLimits(cryptoType: string): { min: number; max: number } {
    const limits: Record<string, { min: number; max: number }> = {
      'BTC': { min: 0.0001, max: 10 },
      'USDT': { min: 10, max: 100000 },
      'USDC': { min: 10, max: 100000 },
    };

    return limits[cryptoType] || { min: 0, max: Infinity };
  }

  /**
   * Requisita saque de colateral
   */
  async requestWithdrawal(
    userId: string,
    cryptoType: string,
    cryptoNetwork: string,
    amount: string,
    destinationAddress: string
  ) {
    const numAmount = parseFloat(amount);

    // Validação 1: Formato do endereço
    if (!this.validateCryptoAddress(destinationAddress, cryptoType, cryptoNetwork)) {
      throw new Error(`Endereço ${cryptoType} inválido para a rede ${cryptoNetwork}`);
    }

    // Validação 2: Limites mínimos/máximos
    const limits = this.getWithdrawalLimits(cryptoType);
    if (numAmount < limits.min) {
      throw new Error(`Valor mínimo para saque: ${limits.min} ${cryptoType}`);
    }
    if (numAmount > limits.max) {
      throw new Error(`Valor máximo para saque: ${limits.max} ${cryptoType}`);
    }

    // Validação 3: Saldo disponível
    const balance = await prisma.collateralBalance.findUnique({
      where: {
        userId_cryptoType_network: {
          userId,
          cryptoType,
          network: cryptoNetwork,
        },
      },
    });

    if (!balance || parseFloat(balance.availableBalance) < numAmount) {
      throw new Error(`Saldo insuficiente. Disponível: ${balance?.availableBalance || 0} ${cryptoType}`);
    }

    // Criar registro de saque
    const withdrawal = await prisma.collateralTransaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL_REQUEST',
        cryptoType,
        cryptoNetwork,
        amount,
        destinationAddress,
        status: 'PENDING',
        metadata: JSON.stringify({
          requestedAt: new Date().toISOString(),
        }),
      },
    });

    // Bloquear saldo temporariamente
    await prisma.collateralBalance.update({
      where: {
        userId_cryptoType_network: {
          userId,
          cryptoType,
          network: cryptoNetwork,
        },
      },
      data: {
        availableBalance: {
          decrement: numAmount,
        },
        lockedAmount: {
          increment: numAmount,
        },
      },
    });

    console.log(`✅ Saque solicitado: ${withdrawal.id}`);
    console.log(`   User: ${userId}`);
    console.log(`   Amount: ${amount} ${cryptoType}`);
    console.log(`   To: ${destinationAddress}`);

    return withdrawal;
  }

  /**
   * Simula conclusão de saque (APENAS PARA DESENVOLVIMENTO)
   */
  async simulateWithdrawalComplete(withdrawalId: string) {
    console.log('⚠️ SIMULANDO CONCLUSÃO DE SAQUE (desenvolvimento)');

    const withdrawal = await prisma.collateralTransaction.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new Error('Saque não encontrado');
    }

    if (withdrawal.type !== 'WITHDRAWAL_REQUEST') {
      throw new Error('Transação não é um saque');
    }

    const mockTxHash = `0x${randomBytes(32).toString('hex')}`;

    // Atualizar status do saque
    const completed = await prisma.collateralTransaction.update({
      where: { id: withdrawalId },
      data: {
        status: 'COMPLETED',
        txHash: mockTxHash,
        metadata: JSON.stringify({
          ...JSON.parse(withdrawal.metadata || '{}'),
          completedAt: new Date().toISOString(),
          simulatedTxHash: mockTxHash,
        }),
      },
    });

    // Deduzir do saldo bloqueado (já foi deduzido do availableBalance)
    await prisma.collateralBalance.update({
      where: {
        userId_cryptoType_network: {
          userId: withdrawal.userId,
          cryptoType: withdrawal.cryptoType,
          network: withdrawal.cryptoNetwork,
        },
      },
      data: {
        balance: {
          decrement: parseFloat(withdrawal.amount),
        },
        lockedAmount: {
          decrement: parseFloat(withdrawal.amount),
        },
      },
    });

    console.log(`✅ Saque completado: ${withdrawalId}`);
    console.log(`   TxHash: ${mockTxHash}`);

    return completed;
  }
}

export const collateralService = new CollateralService();
