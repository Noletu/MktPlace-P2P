import { PrismaClient, Wallet } from '@prisma/client';
import { CryptoType, NetworkType, CRYPTO_SUPPORTED_NETWORKS } from '@mktplace/shared';
import WAValidator from 'multicoin-address-validator';

const prisma = new PrismaClient();

export interface CreateWalletInput {
  userId: string;
  crypto: CryptoType;
  network: NetworkType;
  address: string;
}

export class WalletService {
  // Mapear nossas redes para o formato da biblioteca de validação
  private getValidatorNetwork(network: NetworkType): string {
    const networkMap: Record<NetworkType, string> = {
      [NetworkType.BITCOIN]: 'bitcoin',
      [NetworkType.ETHEREUM]: 'ethereum',
      [NetworkType.TRC20]: 'tron',
      [NetworkType.BASE]: 'ethereum', // Base usa endereços Ethereum
      [NetworkType.ARBITRUM]: 'ethereum', // Arbitrum usa endereços Ethereum
    };
    return networkMap[network];
  }

  async createWallet(input: CreateWalletInput): Promise<Wallet> {
    // Validar se a rede é suportada pela cripto
    const supportedNetworks = CRYPTO_SUPPORTED_NETWORKS[input.crypto];
    if (!supportedNetworks.includes(input.network)) {
      throw new Error(`Rede ${input.network} não suportada para ${input.crypto}. Redes válidas: ${supportedNetworks.join(', ')}`);
    }

    // Validar endereço conforme a rede
    const validatorNetwork = this.getValidatorNetwork(input.network);
    const isValid = WAValidator.validate(input.address, validatorNetwork);

    if (!isValid) {
      throw new Error(`Endereço de carteira inválido para ${input.crypto} na rede ${input.network}. Verifique se o endereço pertence à rede correta.`);
    }

    // Verificar se endereço já existe para este usuário (evitar duplicatas do mesmo endereço)
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId: input.userId,
        address: input.address,
      },
    });

    if (existingWallet) {
      throw new Error('Este endereço de carteira já foi cadastrado');
    }

    // Criar carteira
    const wallet = await prisma.wallet.create({
      data: {
        userId: input.userId,
        crypto: input.crypto,
        network: input.network,
        address: input.address,
        balance: '0',
        isActive: true,
      },
    });

    return wallet;
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    const wallets = await prisma.wallet.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wallets;
  }

  async getWalletById(walletId: string, userId: string): Promise<Wallet | null> {
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
      },
    });

    return wallet;
  }

  async updateWalletBalance(walletId: string, balance: string): Promise<Wallet> {
    const wallet = await prisma.wallet.update({
      where: { id: walletId },
      data: { balance },
    });

    return wallet;
  }

  async deactivateWallet(walletId: string, userId: string): Promise<void> {
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
      },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    // Verificar se há saldo
    if (parseFloat(wallet.balance) > 0) {
      throw new Error('Não é possível desativar carteira com saldo. Retire os fundos primeiro.');
    }

    await prisma.wallet.update({
      where: { id: walletId },
      data: { isActive: false },
    });
  }

  async deleteWallet(walletId: string, userId: string): Promise<void> {
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId,
      },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    // Verificar se há saldo
    if (parseFloat(wallet.balance) > 0) {
      throw new Error('Não é possível deletar carteira com saldo. Retire os fundos primeiro.');
    }

    // Deletar permanentemente
    await prisma.wallet.delete({
      where: { id: walletId },
    });
  }

  async getTotalBalanceInBRL(userId: string): Promise<number> {
    // TODO: Implementar cálculo de saldo total em BRL usando priceService
    return 0;
  }
}

export const walletService = new WalletService();
