import { PrismaClient } from '@prisma/client';
import { internalBalanceService } from './internal-balance.service';
import { blockchainService } from './blockchain.service';

const prisma = new PrismaClient();

// Configuração de taxas de devolução
export const REFUND_CONFIG = {
  NETWORK_FEE_BUFFER_PERCENTAGE: 0.02, // 2% margem de segurança
  MIN_BLOCKCHAIN_REFUND: '5', // USDT mínimo para devolver via blockchain

  // Estimativas de taxa de rede (em USDT equivalente)
  NETWORK_FEES: {
    BASE: '0.50', // BASE L2
    ARBITRUM: '0.30', // Arbitrum L2
    SOLANA: '0.01', // Solana (muito barata)
    ETHEREUM: '10.00', // Ethereum mainnet (mais cara)
    BITCOIN: '5.00', // Bitcoin
  },
};

export class RefundService {
  /**
   * Estimar valores de devolução
   */
  async estimateRefund(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const collateralAmount = parseFloat(order.cryptoAmount);
    const network = order.cryptoNetwork as keyof typeof REFUND_CONFIG.NETWORK_FEES;

    // Estimativa de taxa de rede
    const networkFeeEstimate = parseFloat(
      REFUND_CONFIG.NETWORK_FEES[network] || '5.00'
    );

    // Taxa de processamento (margem de segurança)
    const processingFee = collateralAmount * REFUND_CONFIG.NETWORK_FEE_BUFFER_PERCENTAGE;

    // Total de taxas
    const totalFees = networkFeeEstimate + processingFee;

    // Valor líquido a devolver via blockchain
    const blockchainRefundAmount = Math.max(0, collateralAmount - totalFees);

    // Valor integral via crédito interno
    const internalCreditAmount = collateralAmount;

    return {
      collateralAmount: collateralAmount.toFixed(8),
      networkFeeEstimate: networkFeeEstimate.toFixed(8),
      processingFee: processingFee.toFixed(8),
      totalFees: totalFees.toFixed(8),
      blockchainRefundAmount: blockchainRefundAmount.toFixed(8),
      internalCreditAmount: internalCreditAmount.toFixed(8),
      cryptoType: order.cryptoType,
      network: order.cryptoNetwork,
      minBlockchainRefund: REFUND_CONFIG.MIN_BLOCKCHAIN_REFUND,
    };
  }

  /**
   * Processar devolução via blockchain
   */
  async refundToBlockchain(orderId: string, userId: string) {
    console.log(`🔄 Iniciando devolução via blockchain para order: ${orderId}`);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    if (order.userId !== userId) {
      throw new Error('Pedido não pertence ao usuário');
    }

    if (order.refundStatus !== 'NOT_REQUIRED' && order.refundStatus !== 'PENDING_USER_CHOICE') {
      throw new Error(`Devolução já processada ou em processamento: ${order.refundStatus}`);
    }

    // Calcular valores
    const estimate = await this.estimateRefund(orderId);
    const refundAmount = parseFloat(estimate.blockchainRefundAmount);

    // Verificar se atinge mínimo
    if (refundAmount < parseFloat(REFUND_CONFIG.MIN_BLOCKCHAIN_REFUND)) {
      throw new Error(
        `Valor de devolução (${refundAmount} ${order.cryptoType}) é menor que o mínimo ` +
        `(${REFUND_CONFIG.MIN_BLOCKCHAIN_REFUND}). Use crédito interno em vez disso.`
      );
    }

    // Marcar como processando
    await prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'PROCESSING',
        refundMethod: 'BLOCKCHAIN',
      },
    });

    try {
      // TODO: Implementar envio real de transação blockchain
      // Por ora, simular com txHash mock
      const mockTxHash = `0x${Math.random().toString(16).substring(2)}${Date.now()}`;

      console.log(`⚠️ [DEV] Simulando envio blockchain - TxHash: ${mockTxHash}`);

      // Atualizar ordem com resultado
      await prisma.order.update({
        where: { id: orderId },
        data: {
          refundStatus: 'COMPLETED',
          refundTxHash: mockTxHash,
          refundAmount: estimate.blockchainRefundAmount,
          refundNetworkFee: estimate.networkFeeEstimate,
          refundProcessingFee: estimate.processingFee,
          refundedAt: new Date(),
        },
      });

      console.log(`✅ Devolução via blockchain completada: ${orderId}`);

      return {
        success: true,
        txHash: mockTxHash,
        refundAmount: estimate.blockchainRefundAmount,
        cryptoType: order.cryptoType,
      };
    } catch (error: any) {
      // Marcar como falha
      await prisma.order.update({
        where: { id: orderId },
        data: {
          refundStatus: 'FAILED',
        },
      });

      throw error;
    }
  }

  /**
   * Processar devolução via crédito interno
   */
  async refundToInternalCredit(orderId: string, userId: string) {
    console.log(`🔄 Iniciando devolução via crédito interno para order: ${orderId}`);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    if (order.userId !== userId) {
      throw new Error('Pedido não pertence ao usuário');
    }

    if (order.refundStatus !== 'NOT_REQUIRED' && order.refundStatus !== 'PENDING_USER_CHOICE') {
      throw new Error(`Devolução já processada ou em processamento: ${order.refundStatus}`);
    }

    // Marcar como processando
    await prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'PROCESSING',
        refundMethod: 'INTERNAL_CREDIT',
      },
    });

    try {
      // Adicionar ao saldo interno (valor integral, sem taxas)
      await internalBalanceService.addBalance(
        userId,
        order.cryptoType,
        order.cryptoNetwork,
        order.cryptoAmount
      );

      // Atualizar ordem
      await prisma.order.update({
        where: { id: orderId },
        data: {
          refundStatus: 'COMPLETED',
          refundAmount: order.cryptoAmount, // Valor integral
          refundNetworkFee: '0',
          refundProcessingFee: '0',
          refundedAt: new Date(),
        },
      });

      console.log(`✅ Devolução via crédito interno completada: ${orderId}`);

      return {
        success: true,
        refundAmount: order.cryptoAmount,
        cryptoType: order.cryptoType,
        message: 'Crédito adicionado ao seu saldo interno. Use em novas transações sem custo adicional.',
      };
    } catch (error: any) {
      // Marcar como falha
      await prisma.order.update({
        where: { id: orderId },
        data: {
          refundStatus: 'FAILED',
        },
      });

      throw error;
    }
  }

  /**
   * Cancelar pedido e preparar para devolução
   */
  async cancelOrderForRefund(orderId: string, userId: string, reason: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    if (order.userId !== userId) {
      throw new Error('Pedido não pertence ao usuário');
    }

    if (order.status !== 'PENDING') {
      throw new Error(`Pedido não pode ser cancelado no status: ${order.status}`);
    }

    // Cancelar pedido
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        refundStatus: 'PENDING_USER_CHOICE', // Aguardar escolha do método
      },
    });

    console.log(`🚫 Pedido cancelado: ${orderId} - Razão: ${reason}`);

    return {
      success: true,
      message: 'Pedido cancelado. Escolha como deseja receber seu colateral de volta.',
      orderId,
    };
  }
}

export const refundService = new RefundService();
