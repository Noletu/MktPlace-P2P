import {PrismaClient} from '@prisma/client';
import BigNumber from 'bignumber.js';
import {DerivationService} from './hd-wallet/derivation.service';
import {KeyManagementService} from './hd-wallet/key-management.service';
import {BlockchainService} from './blockchain/blockchain.service';
import {FeeEstimatorService} from './blockchain/fee-estimator.service';

const prisma = new PrismaClient();

/**
 * Wallet Service
 *
 * Gerencia carteiras HD dos usuários.
 * Responsável por:
 * - Criar carteiras HD derivadas (BIP32/BIP44)
 * - Consultar saldos
 * - Bloquear/desbloquear saldos (para colateral em pedidos)
 * - Gerenciar histórico de transações
 * - Processar saques
 */
export class WalletService {
  /**
   * Cria uma nova carteira HD para um usuário
   *
   * @param userId ID do usuário
   * @param cryptoType BTC, USDC, USDT
   * @param network BITCOIN, ETHEREUM, BASE, ARBITRUM, SOLANA
   * @returns Carteira criada (sem expor private key!)
   */
  static async createWallet(
    userId: string,
    cryptoType: string,
    network: string,
    options?: { source?: string; details?: Record<string, any> }
  ) {
    // Verificar se carteira já existe
    const existing = await prisma.userWallet.findUnique({
      where: {
        userId_cryptoType_network: {
          userId,
          cryptoType,
          network,
        },
      },
    });

    if (existing) {
      throw new Error(
        `Wallet already exists for ${cryptoType}/${network}`
      );
    }

    // Derivar carteira HD
    const {address, privateKey, derivationPath} =
      DerivationService.deriveWallet(userId, cryptoType, network);

    // Criptografar private key
    const encryptedPrivateKey = KeyManagementService.encryptPrivateKey(
      privateKey,
      userId
    );

    // Consultar saldo inicial on-chain
    let initialBalance = '0';
    try {
      initialBalance = await BlockchainService.getBalance(address, network);
    } catch (error) {
      console.warn(
        `Could not fetch initial balance for ${address}:`,
        (error as Error).message
      );
    }

    // Salvar no banco
    const wallet = await prisma.userWallet.create({
      data: {
        userId,
        cryptoType,
        network,
        address,
        derivationPath,
        encryptedPrivateKey,
        balance: initialBalance,
        availableBalance: initialBalance,
        lockedBalance: '0',
        totalDeposited: initialBalance,
        isActive: true,
        lastSyncedAt: new Date(),
        creationSource: options?.source ?? 'SYSTEM',
        creationDetails: options?.details ? JSON.stringify(options.details) : null,
      },
    });

    console.log(
      `🔍 [AUDIT] Wallet criada: user=${userId}, ${cryptoType}/${network}, source=${options?.source ?? 'SYSTEM'}, address=${address.slice(0, 8)}...${address.slice(-6)}`
    );

    // Retornar sem private key
    return {
      id: wallet.id,
      userId: wallet.userId,
      cryptoType: wallet.cryptoType,
      network: wallet.network,
      address: wallet.address,
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
      totalDeposited: wallet.totalDeposited,
      totalWithdrawn: wallet.totalWithdrawn,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
    };
  }

  /**
   * Busca uma carteira específica
   */
  static async getWallet(walletId: string) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    return this.sanitizeWallet(wallet);
  }

  /**
   * Busca uma carteira por userId, crypto e network
   */
  static async getWalletByUserAndCrypto(
    userId: string,
    cryptoType: string,
    network: string
  ) {
    const wallet = await prisma.userWallet.findUnique({
      where: {
        userId_cryptoType_network: {
          userId,
          cryptoType,
          network,
        },
      },
    });

    if (!wallet) {
      return null;
    }

    return this.sanitizeWallet(wallet);
  }

  /**
   * Lista todas as carteiras de um usuário
   */
  static async getUserWallets(userId: string) {
    const wallets = await prisma.userWallet.findMany({
      where: {userId},
      orderBy: {createdAt: 'desc'},
    });

    // Fix: corrigir saldos bloqueados negativos diretamente (sempre invalido)
    for (const wallet of wallets) {
      const locked = parseFloat(wallet.lockedBalance);
      if (locked < 0) {
        const balance = parseFloat(wallet.balance);
        const correctedAvailable = Math.max(0, balance).toString();
        console.log(
          `🚨 [FIX] Wallet ${wallet.id} (${wallet.cryptoType}) tem lockedBalance negativo: ${wallet.lockedBalance}. Corrigindo para 0.`
        );
        await prisma.userWallet.update({
          where: { id: wallet.id },
          data: {
            lockedBalance: '0',
            availableBalance: correctedAvailable,
          },
        });
        wallet.lockedBalance = '0';
        wallet.availableBalance = correctedAvailable;
      }
    }

    return wallets.map((w) => this.sanitizeWallet(w));
  }

  /**
   * Obtém saldo atual de uma carteira
   */
  static async getBalance(walletId: string) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    return {
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
      lastSyncedAt: wallet.lastSyncedAt,
    };
  }

  /**
   * Bloqueia saldo para uso em pedido (colateral)
   *
   * @param walletId ID da carteira
   * @param amount Valor a bloquear
   * @param orderId ID do pedido
   * @param reason Motivo do bloqueio
   */
  static async lockBalance(
    walletId: string,
    amount: string,
    orderId: string,
    reason: string = 'Collateral locked for order'
  ) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const availableBalance = parseFloat(wallet.availableBalance);
    const amountToLock = parseFloat(amount);

    if (availableBalance < amountToLock) {
      throw new Error(
        `Insufficient balance. Available: ${availableBalance}, Required: ${amountToLock}`
      );
    }

    // Atualizar saldos
    const newAvailableBalance = availableBalance - amountToLock;
    const newLockedBalance =
      parseFloat(wallet.lockedBalance) + amountToLock;

    await prisma.$transaction([
      // Atualizar carteira
      prisma.userWallet.update({
        where: {id: walletId},
        data: {
          availableBalance: newAvailableBalance.toString(),
          lockedBalance: newLockedBalance.toString(),
        },
      }),

      // Registrar transação
      prisma.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'LOCK',
          amount: amount,
          balanceBefore: wallet.availableBalance,
          balanceAfter: newAvailableBalance.toString(),
          description: reason,
          metadata: JSON.stringify({
            orderId,
            lockedAmount: amount,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ]);

    console.log(
      `🔒 Locked ${amount} ${wallet.cryptoType} in wallet ${walletId} for order ${orderId}`
    );

    return {
      success: true,
      newAvailableBalance: newAvailableBalance.toString(),
      newLockedBalance: newLockedBalance.toString(),
    };
  }

  /**
   * Desbloqueia saldo previamente bloqueado
   *
   * @param walletId ID da carteira
   * @param amount Valor a desbloquear
   * @param orderId ID do pedido
   * @param reason Motivo do desbloqueio
   */
  static async unlockBalance(
    walletId: string,
    amount: string,
    orderId: string,
    reason: string = 'Collateral unlocked'
  ) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const lockedBalance = parseFloat(wallet.lockedBalance);
    const amountToUnlock = parseFloat(amount);

    if (lockedBalance < amountToUnlock) {
      throw new Error(
        `Cannot unlock ${amountToUnlock}. Only ${lockedBalance} is locked.`
      );
    }

    // Atualizar saldos
    const newLockedBalance = lockedBalance - amountToUnlock;
    const newAvailableBalance =
      parseFloat(wallet.availableBalance) + amountToUnlock;

    await prisma.$transaction([
      // Atualizar carteira
      prisma.userWallet.update({
        where: {id: walletId},
        data: {
          availableBalance: newAvailableBalance.toString(),
          lockedBalance: newLockedBalance.toString(),
        },
      }),

      // Registrar transação
      prisma.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'UNLOCK',
          amount: amount,
          balanceBefore: wallet.availableBalance,
          balanceAfter: newAvailableBalance.toString(),
          description: reason,
          metadata: JSON.stringify({
            orderId,
            unlockedAmount: amount,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ]);

    console.log(
      `🔓 Unlocked ${amount} ${wallet.cryptoType} in wallet ${walletId} for order ${orderId}`
    );

    return {
      success: true,
      newAvailableBalance: newAvailableBalance.toString(),
      newLockedBalance: newLockedBalance.toString(),
    };
  }

  /**
   * Deduz saldo permanentemente (ex: taxa, penalidade)
   *
   * @param walletId ID da carteira
   * @param amount Valor a deduzir
   * @param reason Motivo da dedução
   * @param fromLocked Se true, deduz do locked balance; se false, do available
   */
  static async deductBalance(
    walletId: string,
    amount: string,
    reason: string,
    fromLocked: boolean = true
  ) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const amountToDeduct = parseFloat(amount);
    let newBalance: string;
    let newAvailableBalance: string;
    let newLockedBalance: string;

    if (fromLocked) {
      // Deduzir de saldo bloqueado
      const lockedBalance = parseFloat(wallet.lockedBalance);
      if (lockedBalance < amountToDeduct) {
        throw new Error(`Insufficient locked balance`);
      }

      newLockedBalance = (lockedBalance - amountToDeduct).toString();
      newAvailableBalance = wallet.availableBalance;
      newBalance = (
        parseFloat(wallet.balance) - amountToDeduct
      ).toString();
    } else {
      // Deduzir de saldo disponível
      const availableBalance = parseFloat(wallet.availableBalance);
      if (availableBalance < amountToDeduct) {
        throw new Error(`Insufficient available balance`);
      }

      newAvailableBalance = (availableBalance - amountToDeduct).toString();
      newLockedBalance = wallet.lockedBalance;
      newBalance = (
        parseFloat(wallet.balance) - amountToDeduct
      ).toString();
    }

    await prisma.$transaction([
      // Atualizar carteira
      prisma.userWallet.update({
        where: {id: walletId},
        data: {
          balance: newBalance,
          availableBalance: newAvailableBalance,
          lockedBalance: newLockedBalance,
          totalUsed: (
            parseFloat(wallet.totalUsed) + amountToDeduct
          ).toString(),
        },
      }),

      // Registrar transação
      prisma.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'DEDUCT',
          amount: amount,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          description: reason,
          metadata: JSON.stringify({
            fromLocked,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ]);

    console.log(
      `💸 Deducted ${amount} ${wallet.cryptoType} from wallet ${walletId} (${reason})`
    );

    return {
      success: true,
      newBalance,
      newAvailableBalance,
      newLockedBalance,
    };
  }

  /**
   * Credita saldo na carteira (transferência interna)
   * Usado quando comprador recebe cripto do vendedor após transação P2P
   *
   * @param walletId ID da carteira
   * @param amount Valor a creditar
   * @param reason Motivo do crédito
   * @param orderId ID do pedido relacionado (opcional)
   */
  static async creditBalance(
    walletId: string,
    amount: string,
    reason: string,
    orderId?: string
  ) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const amountToCredit = parseFloat(amount);

    // Atualizar saldos
    const newBalance = (parseFloat(wallet.balance) + amountToCredit).toString();
    const newAvailableBalance = (parseFloat(wallet.availableBalance) + amountToCredit).toString();

    await prisma.$transaction([
      // Atualizar carteira
      prisma.userWallet.update({
        where: {id: walletId},
        data: {
          balance: newBalance,
          availableBalance: newAvailableBalance,
          totalDeposited: (parseFloat(wallet.totalDeposited) + amountToCredit).toString(),
        },
      }),

      // Registrar transação
      prisma.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'CREDIT',
          amount: amount,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          description: reason,
          orderId: orderId,
          metadata: JSON.stringify({
            creditAmount: amount,
            orderId: orderId,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ]);

    console.log(
      `✅ Credited ${amount} ${wallet.cryptoType} to wallet ${walletId} (${reason})`
    );

    return {
      success: true,
      newBalance,
      newAvailableBalance,
    };
  }

  /**
   * Força sincronização do saldo com blockchain
   */
  static async syncBalanceFromBlockchain(walletId: string) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    console.log(
      `🔄 Syncing wallet ${walletId} (${wallet.cryptoType}/${wallet.network})...`
    );

    const onChainBalance = await BlockchainService.getBalance(
      wallet.address,
      wallet.network
    );

    const currentBalance = parseFloat(onChainBalance);
    const savedBalance = parseFloat(wallet.balance);

    // Atualizar saldo
    const newAvailableBalance = Math.max(
      0,
      currentBalance - parseFloat(wallet.lockedBalance)
    );

    await prisma.userWallet.update({
      where: {id: walletId},
      data: {
        balance: onChainBalance,
        availableBalance: newAvailableBalance.toString(),
        lastSyncedAt: new Date(),
      },
    });

    console.log(
      `✅ Wallet synced: ${savedBalance} → ${currentBalance} ${wallet.cryptoType}`
    );

    return {
      success: true,
      oldBalance: savedBalance.toString(),
      newBalance: currentBalance.toString(),
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Adiciona saldo de teste a uma carteira (DEV ONLY)
   *
   * @param walletId ID da carteira
   * @param amount Valor a adicionar
   * @returns Informações sobre o saldo adicionado
   */
  static async addTestBalance(walletId: string, amount: string) {
    // Proteção de ambiente
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test balance feature is disabled in production');
    }

    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const amountToAdd = parseFloat(amount);
    if (amountToAdd <= 0 || isNaN(amountToAdd)) {
      throw new Error('Amount must be a positive number');
    }

    // Calcular novos saldos
    const currentBalance = parseFloat(wallet.balance);
    const currentAvailable = parseFloat(wallet.availableBalance);

    const newBalance = currentBalance + amountToAdd;
    const newAvailableBalance = currentAvailable + amountToAdd;

    // Atualizar carteira e criar registro de transação
    await prisma.$transaction([
      // Atualizar saldos
      prisma.userWallet.update({
        where: {id: walletId},
        data: {
          balance: newBalance.toString(),
          availableBalance: newAvailableBalance.toString(),
          totalDeposited: (
            parseFloat(wallet.totalDeposited) + amountToAdd
          ).toString(),
          lastSyncedAt: new Date(),
        },
      }),

      // Registrar transação para auditoria
      prisma.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: 'DEPOSIT',
          amount: amount,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance.toString(),
          description: '[TEST] Added test balance for development/testing',
          metadata: JSON.stringify({
            testBalance: true,
            addedAmount: amount,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ]);

    console.log(
      `🧪 [TEST] Added ${amount} ${wallet.cryptoType} test balance to wallet ${walletId}`
    );

    return {
      success: true,
      walletId,
      amountAdded: amount,
      newBalance: newBalance.toString(),
      newAvailableBalance: newAvailableBalance.toString(),
      cryptoType: wallet.cryptoType,
      network: wallet.network,
    };
  }

  /**
   * Obtém histórico de transações de uma carteira
   */
  static async getTransactions(
    walletId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const transactions = await prisma.walletTransaction.findMany({
      where: {walletId},
      orderBy: {createdAt: 'desc'},
      take: limit,
      skip: offset,
    });

    return transactions;
  }

  /**
   * Valida formato de endereço por rede
   */
  static validateAddress(address: string, network: string): boolean {
    switch (network) {
      case 'BITCOIN':
        // bech32 (bc1), P2PKH (1), P2SH (3)
        return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return /^0x[0-9a-fA-F]{40}$/.test(address);
      case 'SOLANA':
        // Base58, 32-44 chars
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      default:
        return false;
    }
  }

  /**
   * Estima custos de um saque antes de confirmar
   */
  static async getWithdrawalEstimate(
    walletId: string,
    amount: string,
    toAddress: string
  ) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    // Validar endereço
    const isValidAddress = this.validateAddress(toAddress, wallet.network);

    // Estimar fee
    const feeEstimate = await FeeEstimatorService.estimateFee(wallet.network, wallet.cryptoType);
    const networkFee = parseFloat(feeEstimate.estimatedFee);
    const amountNum = parseFloat(amount);

    // Para tokens (USDT/USDC), a fee é paga em moeda nativa
    const isToken = ['USDT', 'USDC'].includes(wallet.cryptoType);
    const amountToReceive = isToken
      ? amount
      : Math.max(0, amountNum - networkFee).toFixed(8);

    // Verificar valor mínimo
    const minimumAmount = FeeEstimatorService.getMinimumWithdrawal(wallet.network, wallet.cryptoType);
    const isAboveMinimum = amountNum >= parseFloat(minimumAmount);

    return {
      amount,
      networkFee: feeEstimate.estimatedFee,
      amountToReceive,
      isToken,
      feeNote: isToken
        ? `A taxa de rede é paga em ${wallet.network === 'SOLANA' ? 'SOL' : 'ETH'} (separada do valor do saque)`
        : `A taxa de rede será descontada do valor enviado`,
      isValid: isValidAddress && isAboveMinimum && amountNum <= parseFloat(wallet.availableBalance),
      isValidAddress,
      isAboveMinimum,
      minimumAmount,
      estimatedTime: feeEstimate.estimatedTime,
    };
  }

  /**
   * Cria solicitação de saque com validações
   *
   * @param walletId ID da carteira
   * @param toAddress Endereço de destino
   * @param amount Valor a sacar
   */
  static async requestWithdrawal(
    walletId: string,
    toAddress: string,
    amount: string
  ) {
    const wallet = await prisma.userWallet.findUnique({
      where: {id: walletId},
      include: { user: true },
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    // 1. Validar endereço por rede
    if (!this.validateAddress(toAddress, wallet.network)) {
      throw new Error(
        `Endereço inválido para a rede ${wallet.network}. Verifique o formato.`
      );
    }

    // 2. Validar valor mínimo
    const minimumAmount = FeeEstimatorService.getMinimumWithdrawal(wallet.network, wallet.cryptoType);
    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount < parseFloat(minimumAmount)) {
      throw new Error(
        `Valor mínimo de saque para ${wallet.cryptoType}/${wallet.network}: ${minimumAmount}`
      );
    }

    // 3. Verificar saldo disponível
    const availableBalance = parseFloat(wallet.availableBalance);
    if (availableBalance < withdrawAmount) {
      throw new Error(
        `Saldo insuficiente. Disponível: ${availableBalance}, Solicitado: ${withdrawAmount}`
      );
    }

    // 4. Verificar conta bloqueada — enfileirar para aprovação
    const isFrozen = wallet.user.accountFrozen;
    const initialStatus = isFrozen ? 'REQUIRES_APPROVAL' : 'PENDING';

    // 5. Criar withdrawal request
    const withdrawal = await prisma.withdrawal.create({
      data: {
        walletId,
        toAddress,
        amount,
        status: initialStatus,
      },
    });

    // 6. Bloquear saldo (será desbloqueado após processamento/rejeição)
    await this.lockBalance(
      walletId,
      amount,
      withdrawal.id,
      `Withdrawal to ${toAddress}`
    );

    console.log(
      `📤 Withdrawal requested: ${amount} ${wallet.cryptoType} to ${toAddress} [status: ${initialStatus}]`
    );

    return {
      ...withdrawal,
      requiresApproval: isFrozen,
    };
  }

  /**
   * Atualizar saldos da carteira manualmente (uso interno)
   */
  static async updateBalance(
    walletId: string,
    data: {
      balance?: string;
      availableBalance?: string;
      lockedBalance?: string;
    }
  ) {
    return await prisma.userWallet.update({
      where: {id: walletId},
      data: {
        ...data,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Recalcula lockedBalance de todas as carteiras de um usuário
   * baseando-se nos pedidos ativos com collateralLocked=true.
   * Corrige inconsistências acumuladas por arredondamento.
   */
  static async recalculateLockedBalance(userId: string) {
    const activeStatuses = ['PENDING', 'MATCHED', 'IN_NEGOTIATION', 'PAYMENT_SENT', 'VALIDATING', 'DISPUTED'];

    const wallets = await prisma.userWallet.findMany({
      where: { userId, isActive: true },
    });

    const results: Array<{ walletId: string; cryptoType: string; diff: string; corrected: boolean }> = [];

    for (const wallet of wallets) {
      try {
        // Pedidos onde esta carteira é o colateral do criador
        const lockedOrders = await prisma.order.findMany({
          where: {
            walletId: wallet.id,
            collateralLocked: true,
            status: { in: activeStatuses },
          },
          select: { id: true, collateralLockedAmount: true, status: true },
        });

        // Pedidos BUY onde este usuário é o provedor
        const lockedBuyOrders = await prisma.order.findMany({
          where: {
            providerWalletId: wallet.id,
            collateralLocked: true,
            status: { in: activeStatuses },
          },
          select: { id: true, collateralLockedAmount: true, status: true },
        });

        const allLocked = [...lockedOrders, ...lockedBuyOrders];
        let realLockedBN = allLocked.reduce(
          (sum, order) => sum.plus(new BigNumber(order.collateralLockedAmount || '0')),
          new BigNumber(0)
        );

        // Saldo bloqueado nunca pode ser negativo
        if (realLockedBN.isNegative()) {
          realLockedBN = new BigNumber(0);
        }

        const currentLockedBN = new BigNumber(wallet.lockedBalance);
        const balanceBN = new BigNumber(wallet.balance);

        console.log(
          `🔍 [recalc] wallet ${wallet.cryptoType}: locked=${currentLockedBN.toFixed(8)}, realLocked=${realLockedBN.toFixed(8)}, orders=${allLocked.length}`
        );

        if (!currentLockedBN.eq(realLockedBN)) {
          // Calcular novo available garantindo que nao ultrapasse o balance total
          let newAvailable = balanceBN.minus(realLockedBN);
          if (newAvailable.isNegative()) {
            newAvailable = new BigNumber(0);
          }

          await prisma.$transaction([
            prisma.userWallet.update({
              where: { id: wallet.id },
              data: {
                lockedBalance: realLockedBN.toFixed(8),
                availableBalance: newAvailable.toFixed(8),
              },
            }),
            prisma.walletTransaction.create({
              data: {
                walletId: wallet.id,
                userId,
                type: 'ADMIN_ADJUSTMENT',
                amount: currentLockedBN.minus(realLockedBN).abs().toFixed(8),
                balanceBefore: wallet.balance,
                balanceAfter: wallet.balance,
                lockedBefore: wallet.lockedBalance,
                lockedAfter: realLockedBN.toFixed(8),
                description: `Auto-correcao saldo bloqueado: ${wallet.lockedBalance} -> ${realLockedBN.toFixed(8)} (${allLocked.length} pedidos ativos)`,
              },
            }),
          ]);

          console.log(
            `🔧 CORRIGIDO wallet ${wallet.id} (${wallet.cryptoType}): locked ${wallet.lockedBalance} → ${realLockedBN.toFixed(8)}, available → ${newAvailable.toFixed(8)}`
          );

          results.push({
            walletId: wallet.id,
            cryptoType: wallet.cryptoType,
            diff: currentLockedBN.minus(realLockedBN).toFixed(8),
            corrected: true,
          });
        } else {
          results.push({
            walletId: wallet.id,
            cryptoType: wallet.cryptoType,
            diff: '0',
            corrected: false,
          });
        }
      } catch (walletError) {
        console.error(`❌ Erro ao recalcular wallet ${wallet.id} (${wallet.cryptoType}):`, walletError);
        results.push({
          walletId: wallet.id,
          cryptoType: wallet.cryptoType,
          diff: '0',
          corrected: false,
        });
      }
    }

    return results;
  }

  /**
   * Remove informações sensíveis da carteira
   */
  private static sanitizeWallet(wallet: any) {
    const {encryptedPrivateKey, derivationPath, ...safeWallet} = wallet;
    return safeWallet;
  }
}

// Exportar instância para compatibilidade com código antigo
export const walletService = new WalletService();
