import { PrismaClient } from '@prisma/client';
import { internalBalanceService } from './internal-balance.service';

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
   *
   * Omnibus: Redireciona para crédito interno.
   * Na arquitetura Omnibus, refunds on-chain exigiriam envio do hot wallet,
   * mas crédito interno é mais rápido, sem custo de rede, e o usuário pode
   * sacar depois via withdrawal normal se desejar.
   */
  async refundToBlockchain(orderId: string, userId: string) {
    console.log(`🔄 Refund blockchain solicitado para order: ${orderId} — redirecionando para crédito interno (Omnibus)`);

    // Na arquitetura Omnibus, refunds são sempre via crédito interno
    // O usuário pode sacar via withdrawal normal se quiser enviar para blockchain
    return this.refundToInternalCredit(orderId, userId);
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
