import { Transaction } from '@prisma/client';
import { TransactionStatus, SubmitProofInput, ValidateProofInput, DisputeInput } from '../types/transaction.types';
import { OrderStatus, OrderType } from '../types/order.types';
import { notificationService } from './notification.service';
import { prisma } from '../utils/prisma';
import { DerivationService } from './hd-wallet/derivation.service';
import { KeyManagementService } from './hd-wallet/key-management.service';
import { auditLogService, AUDIT_ACTIONS, AUDIT_RESOURCES } from './auditLog.service';
import BigNumber from 'bignumber.js';
import { toBN, sumBN } from '../utils/money';
import { PlatformWalletService } from './platformWallet.service';
import { emailService } from './email.service';

export class TransactionService {
  /**
   * Submeter comprovante de pagamento
   */
  async submitProof(input: SubmitProofInput): Promise<Transaction> {
    const validationDeadline = new Date();
    validationDeadline.setHours(validationDeadline.getHours() + 24);

    // CRIT-05: claim atômico — read+validate+write em transação única elimina TOCTOU.
    // updateMany com WHERE status=PENDING + payerId garante que apenas um caller
    // simultâneo transita para VALIDATING; os demais recebem count=0.
    const txRecord = await prisma.$transaction(async (tx) => {
      const claimResult = await tx.transaction.updateMany({
        where: {
          id: input.transactionId,
          status: TransactionStatus.PENDING,
          payerId: input.userId,
        },
        data: {
          comprovanteData: input.comprovanteData,
          comprovanteUrl: input.comprovanteUrl,
          status: TransactionStatus.VALIDATING,
          validationDeadline,
        },
      });

      if (claimResult.count === 0) {
        const existing = await tx.transaction.findUnique({
          where: { id: input.transactionId },
          select: { status: true, payerId: true },
        });
        if (!existing) throw new Error('Transação não encontrada');
        if (existing.payerId !== input.userId) throw new Error('Você não tem permissão para enviar comprovante desta transação');
        throw new Error('Esta transação não está aguardando comprovante');
      }

      const updated = await tx.transaction.findUnique({
        where: { id: input.transactionId },
        include: { order: true },
      });

      await tx.order.update({
        where: { id: updated!.orderId },
        data: { status: OrderStatus.PAYMENT_SENT },
      });

      return updated!;
    });

    // Enviar notificação + email para o vendedor
    setImmediate(async () => {
      try {
        await notificationService.notifyPaymentSent(
          txRecord.orderId,
          txRecord.order.userId, // seller
          txRecord.payerId // buyer
        );

        const [sellerUser, buyerUser] = await Promise.all([
          prisma.user.findUnique({ where: { id: txRecord.order.userId }, select: { email: true, name: true } }),
          prisma.user.findUnique({ where: { id: txRecord.payerId }, select: { email: true, name: true } }),
        ]);
        if (sellerUser?.email) {
          emailService.sendIfAllowed(txRecord.order.userId, 'PAYMENTS', () =>
            emailService.sendPaymentSentEmail(sellerUser.email, {
              name: sellerUser.name || 'Usuário',
              crypto: txRecord.order.cryptoType,
              cryptoAmount: txRecord.order.cryptoAmount.toString(),
              brlAmount: txRecord.order.brlAmount.toString(),
              buyerName: buyerUser?.name || 'Comprador',
            })
          ).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to send payment sent notification:', error);
      }
    });

    return txRecord as unknown as Transaction;
  }

  /**
   * Validar comprovante (manual ou automático)
   * REFATORADO: Todas as operações críticas em transação atômica única
   */
  async validateProof(input: ValidateProofInput): Promise<Transaction> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      include: { order: true },
    });

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    if (transaction.status !== TransactionStatus.VALIDATING) {
      throw new Error('Esta transação não está em validação');
    }

    if (input.approved) {
      // TRANSAÇÃO ATÔMICA: Incluir TODAS as operações críticas
      const updatedTransaction = await prisma.$transaction(async (tx) => {
        // SECURITY (H-7): Idempotência atômica — usar UPDATE WHERE status='VALIDATING'
        // Garante que apenas UM validador pode processar, mesmo com requests simultâneos
        const claimResult = await tx.transaction.updateMany({
          where: { id: input.transactionId, status: TransactionStatus.VALIDATING },
          data: {
            status: TransactionStatus.APPROVED,
            validationScore: input.validationScore || 100,
            validatedBy: input.validatedBy,
            validatedAt: new Date(),
          },
        });

        if (claimResult.count === 0) {
          // Já foi processado por outro validador simultâneo — retornar sem reprocessar
          const existing = await tx.transaction.findUnique({ where: { id: input.transactionId } });
          console.log(`⚠️ Transação ${input.transactionId} já foi processada (idempotência atômica)`);
          return existing!;
        }

        // Buscar transação atualizada para usar nas etapas seguintes
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const approved = (await tx.transaction.findUnique({
          where: { id: input.transactionId },
        }))!;

        // 2. Atualizar status do pedido e transferir cripto
        // NOTA: Para BUY orders, o buyer e order.userId (nao transaction.payerId)
        const isBuyOrderForUpdate = transaction.order.orderType === OrderType.BUY;
        const cryptoRecipient = isBuyOrderForUpdate
          ? transaction.order.userId // BUY: criador da ordem recebe crypto
          : transaction.payerId; // SELL: pagador recebe crypto

        const completedOrder = await tx.order.update({
          where: { id: transaction.orderId },
          data: {
            status: OrderStatus.COMPLETED,
            completedAt: new Date(),
            collateralLocked: false,
            collateralUnlockedAt: new Date(),
            // Marcar transferência de cripto
            cryptoTransferred: true,
            cryptoTransferredAt: new Date(),
            cryptoTransferredTo: cryptoRecipient, // quem recebeu a crypto
          },
        });

        console.log(`✅ Transação aprovada e pedido completado: ${transaction.orderId}`);

        // 3. TRANSFERIR CRIPTO do vendedor para o comprador
        // NOTA: Para BUY orders, o fluxo é diferente:
        // - SELL: seller=order.userId, buyer=transaction.payerId
        // - BUY: seller=order.providerId, buyer=order.userId

        // 3.1 Validação: verificar se ordem ainda não foi transferida (idempotência)
        if (transaction.order.cryptoTransferred) {
          console.log(`⚠️ Cripto já foi transferida para pedido ${transaction.orderId} - pulando transferência`);
          return approved;
        }

        // 3.2 Identificar vendedor (quem tem crypto) e comprador (quem recebe crypto)
        const isBuyOrder = completedOrder.orderType === OrderType.BUY;
        const sellerId = isBuyOrder ? completedOrder.providerId : completedOrder.userId;
        const buyerId = isBuyOrder ? completedOrder.userId : transaction.payerId;
        const sellerWalletId = isBuyOrder ? completedOrder.providerWalletId : completedOrder.walletId;

        console.log(`📊 Order type: ${completedOrder.type}`);
        console.log(`   Seller (crypto source): ${sellerId}`);
        console.log(`   Buyer (crypto recipient): ${buyerId}`);

        // 3.3 Buscar carteira do VENDEDOR (onde colateral está bloqueado)
        if (!sellerWalletId) {
          throw new Error('Order has no wallet (collateral source)');
        }

        const sellerWallet = await tx.userWallet.findUnique({
          where: { id: sellerWalletId },
        });

        if (!sellerWallet) {
          throw new Error('Seller wallet not found');
        }

        // 3.4 Buscar/criar carteira do COMPRADOR (mesma crypto/network)
        let buyerWallet = await tx.userWallet.findUnique({
          where: {
            userId_cryptoType_network: {
              userId: buyerId,
              cryptoType: completedOrder.cryptoType,
              network: completedOrder.cryptoNetwork,
            },
          },
        });

        // 3.5 Se comprador não tem carteira, CRIAR agora (dentro da transação)
        if (!buyerWallet) {
          console.log(`📝 Criando carteira para comprador ${buyerId}...`);

          // CRIT-02: buscar hdAccountIndex persistido dentro da mesma tx (leitura consistente)
          const buyerUser = await tx.user.findUnique({
            where: { id: buyerId! },
            select: { hdAccountIndex: true },
          });
          if (!buyerUser) throw new Error(`Buyer user not found: ${buyerId}`);

          const { address, privateKey, derivationPath } = DerivationService.deriveUserWallet(
            buyerUser.hdAccountIndex,
            completedOrder.cryptoType,
            completedOrder.cryptoNetwork
          );

          const encryptedPrivateKey = KeyManagementService.encryptPrivateKey(
            privateKey,
            buyerId
          );

          buyerWallet = await tx.userWallet.create({
            data: {
              userId: buyerId,
              cryptoType: completedOrder.cryptoType,
              network: completedOrder.cryptoNetwork,
              address,
              derivationPath,
              encryptedPrivateKey,
              balance: '0',
              availableBalance: '0',
              lockedBalance: '0',
              totalDeposited: '0',
              isActive: true,
              lastSyncedAt: new Date(),
            },
          });

          console.log(`✅ Carteira criada: ${buyerWallet.address}`);
        }

        // 3.6 Calcular valor total a transferir
        // SELL: crypto + payerReward (1% cashback para comprador)
        // BUY: apenas crypto (sem cashback - provedor já recebe 2.5% no BRL)
        const cryptoAmountBN = toBN(completedOrder.cryptoAmount);
        const payerRewardBN = isBuyOrder
          ? toBN('0') // BUY orders: sem cashback
          : toBN(completedOrder.payerReward || '0'); // SELL orders: 1% cashback
        const totalToTransferBN = cryptoAmountBN.plus(payerRewardBN);

        // 3.6 Validacao: verificar se vendedor tem saldo bloqueado suficiente
        const sellerLockedBalanceBN = toBN(sellerWallet.lockedBalance);
        if (sellerLockedBalanceBN.lt(totalToTransferBN)) {
          throw new Error(
            `Insufficient locked balance. Seller has ${sellerLockedBalanceBN.toFixed(8)} locked, needs ${totalToTransferBN.toFixed(8)}`
          );
        }

        // 3.7 DEDUZIR do vendedor (do saldo LOCKED)
        const sellerNewLockedBN = sellerLockedBalanceBN.minus(totalToTransferBN);
        const sellerNewBalanceBN = toBN(sellerWallet.balance).minus(totalToTransferBN);

        await tx.userWallet.update({
          where: { id: sellerWallet.id },
          data: {
            balance: sellerNewBalanceBN.toFixed(8),
            lockedBalance: sellerNewLockedBN.toFixed(8),
            totalUsed: toBN(sellerWallet.totalUsed).plus(totalToTransferBN).toFixed(8),
          },
        });

        // 3.8 CREDITAR no comprador (no saldo AVAILABLE)
        const buyerNewBalanceBN = toBN(buyerWallet.balance).plus(totalToTransferBN);
        const buyerNewAvailableBN = toBN(buyerWallet.availableBalance).plus(totalToTransferBN);

        await tx.userWallet.update({
          where: { id: buyerWallet.id },
          data: {
            balance: buyerNewBalanceBN.toFixed(8),
            availableBalance: buyerNewAvailableBN.toFixed(8),
            totalDeposited: toBN(buyerWallet.totalDeposited).plus(totalToTransferBN).toFixed(8),
          },
        });

        // 3.10 Registrar transacao de DEDUCT (vendedor)
        await tx.walletTransaction.create({
          data: {
            walletId: sellerWallet.id,
            userId: sellerWallet.userId,
            orderId: completedOrder.id,
            type: 'DEDUCT',
            amount: totalToTransferBN.toFixed(8),
            balanceBefore: sellerWallet.balance,
            balanceAfter: sellerNewBalanceBN.toFixed(8),
            lockedBefore: sellerWallet.lockedBalance,
            lockedAfter: sellerNewLockedBN.toFixed(8),
            description: `Crypto transferred to buyer (Order ${completedOrder.id})`,
            metadata: JSON.stringify({
              orderId: completedOrder.id,
              orderType: completedOrder.type,
              buyerUserId: buyerId,
              buyerWalletId: buyerWallet.id,
              cryptoAmount: completedOrder.cryptoAmount,
              payerReward: payerRewardBN.toFixed(8),
              totalTransferred: totalToTransferBN.toFixed(8),
              timestamp: new Date().toISOString(),
            }),
          },
        });

        // 3.11 Registrar transacao de CREDIT (comprador)
        await tx.walletTransaction.create({
          data: {
            walletId: buyerWallet.id,
            userId: buyerWallet.userId,
            orderId: completedOrder.id,
            type: 'CREDIT',
            amount: totalToTransferBN.toFixed(8),
            balanceBefore: buyerWallet.balance,
            balanceAfter: buyerNewBalanceBN.toFixed(8),
            description: `Crypto received from seller (Order ${completedOrder.id})`,
            metadata: JSON.stringify({
              orderId: completedOrder.id,
              orderType: completedOrder.type,
              sellerUserId: sellerId,
              sellerWalletId: sellerWallet.id,
              cryptoAmount: completedOrder.cryptoAmount,
              payerReward: payerRewardBN.toFixed(8),
              totalReceived: totalToTransferBN.toFixed(8),
              timestamp: new Date().toISOString(),
            }),
          },
        });

        console.log(`💸 Crypto transferida: ${totalToTransferBN.toFixed(8)} ${completedOrder.cryptoType}`);
        console.log(`   Vendedor: ${sellerId} → Comprador: ${buyerId}`);

        // 3.12 TRANSFERIR PLATFORM FEE para carteira da plataforma
        const platformFeeBN = toBN(completedOrder.platformFee || '0');

        if (platformFeeBN.gt(0)) {
          // Buscar/criar carteira da plataforma
          let platformWallet = await tx.platformWallet.findFirst({
            where: {
              cryptoType: completedOrder.cryptoType,
              network: completedOrder.cryptoNetwork,
            },
          });

          if (!platformWallet) {
            console.log(`⚠️ Platform wallet not found for ${completedOrder.cryptoType}/${completedOrder.cryptoNetwork} - creating...`);
            // Derivar endereco da plataforma
            const { address, privateKey, derivationPath } = DerivationService.derivePlatformWallet(
              completedOrder.cryptoType,
              completedOrder.cryptoNetwork
            );

            // Verificar se ja existe uma wallet com esse endereco (pode ter sido criada para outra crypto/rede)
            const existingByAddress = await tx.platformWallet.findFirst({
              where: { address },
            });

            if (existingByAddress) {
              // Usar a wallet existente
              console.log(`✅ Found existing platform wallet by address: ${address}`);
              platformWallet = existingByAddress;
            } else {
              // Criar nova wallet
              const encryptedPrivateKey = KeyManagementService.encryptPrivateKey(privateKey, 'PLATFORM');
              platformWallet = await tx.platformWallet.create({
                data: {
                  cryptoType: completedOrder.cryptoType,
                  network: completedOrder.cryptoNetwork,
                  address,
                  derivationPath,
                  encryptedPrivateKey,
                  balance: '0',
                  isActive: true,
                },
              });
              console.log(`✅ Created new platform wallet: ${address}`);
            }
          }

          // Deduzir platform fee do vendedor
          // SELL: fee vem do available (NÃO faz parte do colateral locked)
          // BUY: fee vem do locked (JÁ estava incluída no colateral do provedor)
          const sellerCurrentWallet = await tx.userWallet.findUnique({ where: { id: sellerWallet.id } });
          const sellerCurrentBalance = toBN(sellerCurrentWallet?.balance || '0');
          const sellerAfterFeeBN = sellerCurrentBalance.minus(platformFeeBN);

          const sellerCurrentLocked = toBN(sellerCurrentWallet?.lockedBalance || '0');
          const sellerCurrentAvailable = toBN(sellerCurrentWallet?.availableBalance || '0');

          if (isBuyOrder) {
            // BUY: deduzir fee do locked (faz parte do colateral do provedor)
            const sellerLockedAfterFeeBN = sellerCurrentLocked.minus(platformFeeBN);
            await tx.userWallet.update({
              where: { id: sellerWallet.id },
              data: {
                balance: sellerAfterFeeBN.toFixed(8),
                lockedBalance: sellerLockedAfterFeeBN.toFixed(8),
              },
            });
          } else {
            // SELL: deduzir fee do available (NÃO do locked)
            const sellerAvailableAfterFeeBN = sellerCurrentAvailable.minus(platformFeeBN);
            await tx.userWallet.update({
              where: { id: sellerWallet.id },
              data: {
                balance: sellerAfterFeeBN.toFixed(8),
                availableBalance: sellerAvailableAfterFeeBN.toFixed(8),
                // lockedBalance: NÃO TOCAR — fee não fazia parte do colateral
              },
            });
          }

          // Creditar na carteira da plataforma
          const platformNewBalanceBN = toBN(platformWallet.balance).plus(platformFeeBN);
          const currentTotalFees = toBN(platformWallet.totalFeesCollected || '0');
          const newTotalFees = currentTotalFees.plus(platformFeeBN);

          await tx.platformWallet.update({
            where: { id: platformWallet.id },
            data: {
              balance: platformNewBalanceBN.toFixed(8),
              totalFeesCollected: newTotalFees.toFixed(8),
            },
          });

          // Registrar transação de platform fee
          const feeLockedAfter = isBuyOrder
            ? sellerCurrentLocked.minus(platformFeeBN).toFixed(8)
            : sellerCurrentLocked.toFixed(8); // SELL: locked não mudou
          await tx.walletTransaction.create({
            data: {
              walletId: sellerWallet.id,
              userId: sellerWallet.userId,
              orderId: completedOrder.id,
              type: 'PLATFORM_FEE',
              amount: platformFeeBN.toFixed(8),
              balanceBefore: sellerCurrentBalance.toFixed(8),
              balanceAfter: sellerAfterFeeBN.toFixed(8),
              lockedBefore: sellerCurrentLocked.toFixed(8),
              lockedAfter: feeLockedAfter,
              description: `Platform fee transferred (Order ${completedOrder.id})`,
              metadata: JSON.stringify({
                orderId: completedOrder.id,
                platformWalletId: platformWallet.id,
                platformFee: platformFeeBN.toFixed(8),
                feeSource: isBuyOrder ? 'locked' : 'available',
                timestamp: new Date().toISOString(),
              }),
            },
          });

          // Registrar movimentação no ledger da platform wallet
          await PlatformWalletService.recordMovement(tx, {
            platformWalletId: platformWallet.id,
            type: 'FEE_RECEIVED',
            direction: 'IN',
            amount: platformFeeBN.toFixed(8),
            balanceBefore: platformWallet.balance.toString(),
            balanceAfter: platformNewBalanceBN.toFixed(8),
            description: `Fee recebida da order ${completedOrder.id} (${completedOrder.cryptoType})`,
            orderId: completedOrder.id,
            userId: sellerWallet.userId,
            metadata: {
              orderType: isBuyOrder ? 'BUY' : 'SELL',
              cryptoType: completedOrder.cryptoType,
              network: completedOrder.network,
              feeSource: isBuyOrder ? 'locked' : 'available',
            },
          });

          console.log(`💰 Platform fee transferida: ${platformFeeBN.toFixed(8)} ${completedOrder.cryptoType}`);
          console.log(`   Platform wallet balance: ${platformNewBalanceBN.toFixed(8)}`);
        }

        return approved;
      }, {
        timeout: 60000, // 60 segundos (aumentado para operações complexas)
        maxWait: 20000, // máximo 20s esperando lock
      });

      console.log(`✅ TRANSAÇÃO ATÔMICA COMPLETA com sucesso!`);

      // Registrar audit logs (fora da transação crítica)
      setImmediate(async () => {
        try {
          // Buscar dados atualizados da order para os logs
          const completedOrder = await prisma.order.findUnique({
            where: { id: transaction.orderId },
            select: {
              id: true,
              type: true,
              userId: true,
              providerId: true,
              cryptoType: true,
              cryptoNetwork: true,
              cryptoAmount: true,
              payerReward: true,
              user: { select: { email: true, legacyRole: true, name: true } },
            },
          });

          if (completedOrder) {
            // Identificar buyer e seller baseado no tipo de ordem
            const isBuyOrderLog = completedOrder.orderType === OrderType.BUY;
            const logBuyerId = isBuyOrderLog ? completedOrder.userId : transaction.payerId;
            const logSellerId = isBuyOrderLog ? completedOrder.providerId : completedOrder.userId;

            // Buscar email/role/name do segundo participante (provider para BUY, payer para SELL)
            const secondUserId = isBuyOrderLog ? completedOrder.providerId : transaction.payerId;
            const secondUser = secondUserId
              ? await prisma.user.findUnique({ where: { id: secondUserId }, select: { email: true, legacyRole: true, name: true } })
              : null;

            // Para BUY: buyer=user(creator), seller=provider; Para SELL: buyer=payer, seller=user(creator)
            const buyerEmail = isBuyOrderLog ? (completedOrder.user?.email ?? '') : (secondUser?.email ?? '');
            const buyerRole = isBuyOrderLog ? (completedOrder.user?.legacyRole ?? '') : (secondUser?.legacyRole ?? '');
            const buyerName = isBuyOrderLog ? (completedOrder.user?.name ?? '') : (secondUser?.name ?? '');
            const sellerEmail = isBuyOrderLog ? (secondUser?.email ?? '') : (completedOrder.user?.email ?? '');
            const sellerRole = isBuyOrderLog ? (secondUser?.legacyRole ?? '') : (completedOrder.user?.legacyRole ?? '');
            const sellerName = isBuyOrderLog ? (secondUser?.name ?? '') : (completedOrder.user?.name ?? '');

            const cryptoAmountLog = toBN(completedOrder.cryptoAmount);
            const payerRewardLog = isBuyOrderLog
              ? toBN('0')
              : toBN(completedOrder.payerReward || '0');
            const totalTransferred = cryptoAmountLog.plus(payerRewardLog);

            // 1. ORDER_COMPLETED - Comprador
            await auditLogService.log({
              userId: logBuyerId,
              email: buyerEmail,
              role: buyerRole,
              name: buyerName,
              action: AUDIT_ACTIONS.ORDER_COMPLETED,
              resource: AUDIT_RESOURCES.TRANSACTION,
              resourceId: completedOrder.id,
              description: `Order completed - Payment validated and approved`,
              metadata: {
                orderId: completedOrder.id,
                orderType: completedOrder.type,
                sellerId: logSellerId,
                buyerId: logBuyerId,
                role: 'buyer',
              },
              success: true,
            });

            // 2. ORDER_COMPLETED - Vendedor
            if (logSellerId) {
              await auditLogService.log({
                userId: logSellerId,
                email: sellerEmail,
                role: sellerRole,
                name: sellerName,
                action: AUDIT_ACTIONS.ORDER_COMPLETED,
                resource: AUDIT_RESOURCES.TRANSACTION,
                resourceId: completedOrder.id,
                description: `Order completed - Payment received and confirmed`,
                metadata: {
                  orderId: completedOrder.id,
                  orderType: completedOrder.type,
                  sellerId: logSellerId,
                  buyerId: logBuyerId,
                  role: 'seller',
                },
                success: true,
              });
            }

            // 3. CRYPTO_TRANSFER - Comprador (visibilidade)
            await auditLogService.log({
              userId: logBuyerId,
              email: buyerEmail,
              role: buyerRole,
              name: buyerName,
              action: AUDIT_ACTIONS.CRYPTO_TRANSFER,
              resource: AUDIT_RESOURCES.TRANSACTION,
              resourceId: completedOrder.id,
              description: `Crypto transferred: ${totalTransferred.toFixed(8)} ${completedOrder.cryptoType} from seller to buyer`,
              metadata: {
                orderId: completedOrder.id,
                orderType: completedOrder.type,
                fromUserId: logSellerId,
                toUserId: logBuyerId,
                cryptoType: completedOrder.cryptoType,
                network: completedOrder.cryptoNetwork,
                amount: totalTransferred.toFixed(8),
                direction: 'SELLER_TO_BUYER',
              },
              success: true,
            });

            // 4. CRYPTO_TRANSFER - Vendedor (visibilidade)
            if (logSellerId) {
              await auditLogService.log({
                userId: logSellerId,
                email: sellerEmail,
                role: sellerRole,
                name: sellerName,
                action: AUDIT_ACTIONS.CRYPTO_TRANSFER,
                resource: AUDIT_RESOURCES.TRANSACTION,
                resourceId: completedOrder.id,
                description: `Crypto transferred: ${totalTransferred.toFixed(8)} ${completedOrder.cryptoType} from seller to buyer`,
                metadata: {
                  orderId: completedOrder.id,
                  orderType: completedOrder.type,
                  fromUserId: logSellerId,
                  toUserId: logBuyerId,
                  cryptoType: completedOrder.cryptoType,
                  network: completedOrder.cryptoNetwork,
                  amount: totalTransferred.toFixed(8),
                  direction: 'SELLER_TO_BUYER',
                },
                success: true,
              });
            }

            console.log(`📝 Audit logs: ORDER_COMPLETED (x2) + CRYPTO_TRANSFER (x2)`);
          }
        } catch (error) {
          console.error('Failed to log audit entries:', error);
        }
      });

      // Atualizar reputacao dos usuarios (fora da transacao critica)
      setImmediate(async () => {
        try {
          // Para BUY orders: buyer=order.userId, seller=order.providerId
          // Para SELL orders: buyer=transaction.payerId, seller=order.userId
          const isBuyOrderRep = transaction.order.orderType === OrderType.BUY;
          const repBuyerId = isBuyOrderRep ? transaction.order.userId : transaction.payerId;
          const repSellerId = isBuyOrderRep ? transaction.order.providerId : transaction.order.userId;

          await this.updateUserReputation(repBuyerId, true);
          if (repSellerId) {
            await this.updateUserReputation(repSellerId, true);
          }
        } catch (error) {
          console.error('Failed to update user reputation:', error);
        }
      });

      // Enviar notificacoes de pagamento validado (fora da transacao critica)
      setImmediate(async () => {
        try {
          // Para BUY orders: buyer=order.userId, seller=order.providerId
          // Para SELL orders: buyer=transaction.payerId, seller=order.userId
          const isBuyOrderNotif = transaction.order.orderType === OrderType.BUY;
          const notifBuyerId = isBuyOrderNotif ? transaction.order.userId : transaction.payerId;
          const notifSellerId = isBuyOrderNotif ? transaction.order.providerId : transaction.order.userId;

          // Notificar comprador que recebeu crypto
          await notificationService.notifyPaymentValidated(
            transaction.orderId,
            notifBuyerId,
            transaction.order.cryptoAmount.toString(),
            transaction.order.cryptoType
          );

          // Notificar vendedor (ou provedor)
          if (notifSellerId) {
            await notificationService.notifyOrderCompleted(
              transaction.orderId,
              notifSellerId,
              true
            );
          }

          // Notificar comprador
          await notificationService.notifyOrderCompleted(
            transaction.orderId,
            notifBuyerId,
            true
          );

          // Emails transacionais para ambas as partes
          const [emailBuyer, emailSeller] = await Promise.all([
            prisma.user.findUnique({ where: { id: notifBuyerId }, select: { email: true, name: true } }),
            notifSellerId ? prisma.user.findUnique({ where: { id: notifSellerId }, select: { email: true, name: true } }) : null,
          ]);
          if (emailBuyer?.email) {
            emailService.sendIfAllowed(notifBuyerId, 'P2P_COMPLETED', () =>
              emailService.sendTransactionCompletedEmail(emailBuyer.email, {
                name: emailBuyer.name || 'Usuário',
                orderType: 'compra',
                crypto: transaction.order.cryptoType,
                cryptoAmount: transaction.order.cryptoAmount.toString(),
                brlAmount: transaction.order.brlAmount.toString(),
              })
            ).catch(() => {});
          }
          if (emailSeller?.email) {
            emailService.sendIfAllowed(notifSellerId!, 'P2P_COMPLETED', () =>
              emailService.sendTransactionCompletedEmail(emailSeller.email, {
                name: emailSeller.name || 'Usuário',
                orderType: 'venda',
                crypto: transaction.order.cryptoType,
                cryptoAmount: transaction.order.cryptoAmount.toString(),
                brlAmount: transaction.order.brlAmount.toString(),
              })
            ).catch(() => {});
          }
        } catch (error) {
          console.error('Failed to send payment validated notifications:', error);
        }
      });

      return updatedTransaction;
    } else {
      // Rejeitar transação + voltar pedido para PENDING atomicamente
      const [updatedTransaction] = await prisma.$transaction([
        prisma.transaction.update({
          where: { id: input.transactionId },
          data: {
            status: TransactionStatus.REJECTED,
            validationScore: input.validationScore || 0,
            validatedBy: input.validatedBy,
            validatedAt: new Date(),
          },
        }),
        prisma.order.update({
          where: { id: transaction.orderId },
          data: { status: OrderStatus.PENDING },
        }),
      ]);

      // Notificar comprador (pagador) que o comprovante foi rejeitado
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: transaction.payerId,
            type: 'PAYMENT_REJECTED',
            category: 'ORDER',
            prefCategory: 'PAYMENTS',
            title: 'Comprovante Rejeitado',
            message: `Seu comprovante de pagamento para ${transaction.order.cryptoAmount} ${transaction.order.cryptoType} foi rejeitado. Envie um novo comprovante.`,
            actionUrl: `/orders/${transaction.orderId}`,
            actionLabel: 'Ver Pedido',
            relatedId: transaction.orderId,
            relatedType: 'ORDER',
            priority: 'HIGH',
          });

          const payerUser = await prisma.user.findUnique({
            where: { id: transaction.payerId },
            select: { email: true, name: true },
          });
          if (payerUser?.email) {
            emailService.sendIfAllowed(transaction.payerId, 'PAYMENTS', () =>
              emailService.sendPaymentRejectedEmail(payerUser.email, {
                name: payerUser.name || 'Usuário',
                crypto: transaction.order.cryptoType,
                cryptoAmount: transaction.order.cryptoAmount.toString(),
                brlAmount: transaction.order.brlAmount.toString(),
              })
            ).catch(() => {});
          }
        } catch (error) {
          console.error('Failed to send payment rejected notifications:', error);
        }
      });

      return updatedTransaction;
    }
  }

  /**
   * Criar disputa
   */
  async createDispute(input: DisputeInput): Promise<Transaction> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      include: { order: true },
    });

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    // Verificar se o usuário é parte da transação
    const isParticipant =
      transaction.payerId === input.userId ||
      transaction.order.userId === input.userId;

    if (!isParticipant) {
      throw new Error('Você não tem permissão para disputar esta transação');
    }

    // Atualizar transação + pedido para DISPUTED atomicamente
    const [updatedTransaction] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id: input.transactionId },
        data: {
          status: TransactionStatus.DISPUTED,
          disputeReason: input.reason,
          disputeData: input.disputeData ? JSON.stringify(input.disputeData) : null,
        },
      }),
      prisma.order.update({
        where: { id: transaction.orderId },
        data: { status: OrderStatus.DISPUTED },
      }),
    ]);

    return updatedTransaction;
  }

  /**
   * Atualizar contadores de transacao e recalcular reputacao composta
   *
   * Incrementa contadores (totalTransactions, successfulTransactions)
   * Delega calculo de reputacao ao ReputationService (score composto)
   */
  async updateUserReputation(userId: string, success: boolean): Promise<void> {
    const { reputationService } = await import('./reputation.service');

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const newTotalTransactions = user.totalTransactions + 1;
    const newSuccessfulTransactions = success
      ? user.successfulTransactions + 1
      : user.successfulTransactions;

    // Atualizar SOMENTE contadores — reputacao sera recalculada pelo ReputationService
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalTransactions: newTotalTransactions,
        successfulTransactions: newSuccessfulTransactions,
      },
    });

    // Recalcular score composto
    await reputationService.recalculateAndSave(userId);
  }

  /**
   * Obter transação por ID
   */
  async getTransactionById(transactionId: string): Promise<Transaction | null> {
    return await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                reputationScore: true,
              },
            },
          },
        },
        payer: {
          select: {
            id: true,
            name: true,
            email: true,
            reputationScore: true,
          },
        },
        fees: true,
      },
    });
  }

  /**
   * Obter transações do usuário
   */
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return await prisma.transaction.findMany({
      where: { payerId: userId },
      include: {
        order: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Histórico completo de transações com filtros avançados
   */
  async getTransactionHistory(filters: {
    userId: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    type?: string; // SENT (pagou) ou RECEIVED (recebeu)
    limit?: number;
    offset?: number;
  }) {
    const where: any = {
      OR: [
        { payerId: filters.userId }, // Transações que pagou
        { order: { userId: filters.userId } }, // Pedidos que criou e recebeu pagamento
      ],
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Filtro por tipo
    if (filters.type === 'SENT') {
      where.OR = [{ payerId: filters.userId }];
    } else if (filters.type === 'RECEIVED') {
      where.OR = [{ order: { userId: filters.userId } }];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  reputationScore: true,
                },
              },
            },
          },
          payer: {
            select: {
              id: true,
              name: true,
              email: true,
              reputationScore: true,
            },
          },
          fees: true,
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    // Adicionar tipo (SENT ou RECEIVED) em cada transação
    const transactionsWithType = transactions.map(tx => ({
      ...tx,
      transactionType: tx.payerId === filters.userId ? 'SENT' : 'RECEIVED',
    }));

    return { transactions: transactionsWithType, total };
  }

  /**
   * Estatísticas de transações do usuário
   */
  async getTransactionStats(userId: string, period?: { startDate?: Date; endDate?: Date }) {
    const where: any = {
      OR: [
        { payerId: userId },
        { order: { userId: userId } },
      ],
    };

    if (period?.startDate || period?.endDate) {
      where.createdAt = {};
      if (period.startDate) where.createdAt.gte = period.startDate;
      if (period.endDate) where.createdAt.lte = period.endDate;
    }

    const [
      totalTransactions,
      sentTransactions,
      receivedTransactions,
      approvedTransactions,
      rejectedTransactions,
      pendingTransactions,
      byStatus,
    ] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, payerId: userId } }),
      prisma.transaction.count({ where: { ...where, order: { userId } } }),
      prisma.transaction.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.transaction.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.transaction.count({ where: { ...where, status: 'PENDING' } }),
      prisma.transaction.groupBy({
        by: ['status'],
        where,
        _count: true,
        orderBy: {
          _count: {
            status: 'desc',
          },
        },
      }),
    ]);

    // Calcular volume total transacionado
    const sentTxs = await prisma.transaction.findMany({
      where: { payerId: userId, status: 'APPROVED' },
      include: { order: true },
    });

    const receivedTxs = await prisma.transaction.findMany({
      where: { order: { userId }, status: 'APPROVED' },
      include: { order: true },
    });

    const totalSent = toBN(sumBN(sentTxs.map(tx => tx.order.brlAmount))).toNumber();
    const totalReceived = toBN(sumBN(receivedTxs.map(tx => tx.order.brlAmount))).toNumber();

    return {
      totalTransactions,
      sentTransactions,
      receivedTransactions,
      approvedTransactions,
      rejectedTransactions,
      pendingTransactions,
      successRate: totalTransactions > 0 ? (approvedTransactions / totalTransactions) * 100 : 0,
      totalSent: totalSent.toFixed(2),
      totalReceived: totalReceived.toFixed(2),
      totalVolume: (totalSent + totalReceived).toFixed(2),
      byStatus,
    };
  }

  /**
   * Timeline de atividades (últimas ações do usuário)
   */
  async getActivityTimeline(userId: string, limit: number = 20) {
    // Buscar transações
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { payerId: userId },
          { order: { userId } },
        ],
      },
      include: {
        order: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        payer: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Buscar pedidos criados
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Combinar e ordenar por data
    const timeline = [
      ...transactions.map(tx => ({
        type: tx.payerId === userId ? 'PAYMENT_SENT' : 'PAYMENT_RECEIVED',
        date: tx.createdAt,
        status: tx.status,
        amount: tx.order.brlAmount,
        crypto: tx.order.cryptoType,
        orderId: tx.orderId,
        transactionId: tx.id,
        description: tx.payerId === userId
          ? `Pagamento de R$ ${tx.order.brlAmount} enviado`
          : `Pagamento de R$ ${tx.order.brlAmount} recebido`,
      })),
      ...orders.map(order => ({
        type: 'ORDER_CREATED',
        date: order.createdAt,
        status: order.status,
        amount: order.brlAmount,
        crypto: order.cryptoType,
        orderId: order.id,
        description: `Pedido de ${order.type} criado no valor de R$ ${order.brlAmount}`,
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);

    return timeline;
  }

  /**
   * Auto-validar comprovante (validação básica automática)
   * TODO: Implementar validação mais sofisticada com OCR/AI
   */
  async autoValidateProof(transactionId: string): Promise<void> {
    const transaction = await this.getTransactionById(transactionId);

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    // Validação básica: verificar se comprovante existe
    if (!transaction.comprovanteData && !transaction.comprovanteUrl) {
      throw new Error('Comprovante não encontrado');
    }

    // Auto-aprovar com score baixo (será melhorado com validação real)
    await this.validateProof({
      transactionId,
      validatedBy: 'SYSTEM_AUTO',
      approved: true,
      validationScore: 70, // Score baixo para validação automática
    });
  }
}

export const transactionService = new TransactionService();
