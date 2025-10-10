import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { blockchainService } from './blockchain.service';
import { adminService } from './admin.service';

const prisma = new PrismaClient();

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
}

export const collateralService = new CollateralService();
