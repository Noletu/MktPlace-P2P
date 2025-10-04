import { PrismaClient, Wallet } from '@prisma/client';
import { CryptoType, Network, CRYPTO_NETWORKS } from '../types/crypto.types';

const prisma = new PrismaClient();

export interface CreateWalletInput {
  userId: string;
  crypto: CryptoType;
  network: Network;
  address: string;
}

export class WalletService {
  async createWallet(input: CreateWalletInput): Promise<Wallet> {
    // Validar se a rede é suportada pela cripto
    const supportedNetworks = CRYPTO_NETWORKS[input.crypto];
    if (!supportedNetworks.includes(input.network)) {
      throw new Error(`Rede ${input.network} não suportada para ${input.crypto}`);
    }

    // Validar endereço básico (pode ser melhorado com validação específica por rede)
    if (!input.address || input.address.length < 10) {
      throw new Error('Endereço de carteira inválido');
    }

    // Verificar se carteira já existe
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId: input.userId,
        crypto: input.crypto,
        network: input.network,
      },
    });

    if (existingWallet) {
      throw new Error('Você já possui uma carteira para esta cripto/rede');
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

  async getTotalBalanceInBRL(userId: string): Promise<number> {
    // TODO: Implementar cálculo de saldo total em BRL usando priceService
    return 0;
  }
}

export const walletService = new WalletService();
