import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification.service';
import {
  DisputeStatus,
  DisputeCategory,
  ResolutionType,
  CreateDisputeInput as CreateDisputeInputType,
  RespondDisputeInput,
  ResolveDisputeInput as ResolveDisputeInputType,
  DISPUTE_DEADLINES,
  DISPUTE_REPUTATION,
} from '../types/dispute.types';
import { OrderStatus } from '../types/order.types';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import { DerivationService } from './hd-wallet/derivation.service';
import BigNumber from 'bignumber.js';
import { toBN } from '../utils/money';
import { PlatformWalletService } from './platformWallet.service';
import { KeyManagementService } from './hd-wallet/key-management.service';

const prisma = new PrismaClient();

// Keep backwards compatibility with old interfaces
export interface CreateDisputeInput {
  orderId: string;
  transactionId?: string;
  createdBy: string;
  category: 'PAYMENT_SENT_NOT_CONFIRMED' | 'CRYPTO_NOT_RELEASED' | 'PAYMENT_NOT_RECEIVED' | 'FAKE_RECEIPT' | 'WRONG_AMOUNT' | 'WRONG_RECIPIENT' | 'OTHER';
  title: string;
  description: string;
  attachments?: string[]; // URLs de evidências ou base64
}

export interface AddMessageInput {
  disputeId: string;
  authorId: string;
  message: string;
  attachments?: string[];
  isAdminMessage?: boolean;
  visibleTo?: string; // userId destinatário (para mensagens privadas de staff)
}

export interface ResolveDisputeInput {
  disputeId: string;
  resolvedBy: string; // Admin ID
  resolution: string; // Descrição da resolução
  resolutionType: 'RELEASE_TO_BUYER' | 'RETURN_TO_SELLER' | 'CANCEL_NO_PENALTY' | 'PENALTY_BUYER' | 'PENALTY_SELLER';
}

export class DisputeService {
  /**
   * Criar nova disputa
   */
  async createDispute(input: CreateDisputeInput) {
    // Verificar se order existe e usuário tem permissão
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        transactions: true,
      },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Verificar se usuário é parte do pedido
    const isOrderOwner = order.userId === input.createdBy;
    const isPayer = order.transactions.some(t => t.payerId === input.createdBy);
    const isProvider = order.providerId === input.createdBy;

    if (!isOrderOwner && !isPayer && !isProvider) {
      throw new Error('Você não tem permissão para criar disputa neste pedido');
    }

    // Verificar se já existe disputa aberta para este pedido
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        orderId: input.orderId,
        status: {
          in: ['OPEN', 'UNDER_REVIEW'],
        },
      },
    });

    if (existingDispute) {
      throw new Error('Já existe uma disputa aberta para este pedido');
    }

    // Criar disputa
    const dispute = await prisma.dispute.create({
      data: {
        orderId: input.orderId,
        transactionId: input.transactionId,
        createdBy: input.createdBy,
        category: input.category,
        title: input.title,
        description: input.description,
        status: 'OPEN',
        messages: {
          create: {
            authorId: input.createdBy,
            message: input.description,
            attachments: input.attachments ? JSON.stringify(input.attachments) : null,
            isAdminMessage: false,
          },
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            type: true,
            status: true,
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
          },
        },
        messages: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Atualizar status do pedido para DISPUTED
    await prisma.order.update({
      where: { id: input.orderId },
      data: { status: 'DISPUTED' },
    });

    // Enviar notificação para a outra parte
    setImmediate(async () => {
      try {
        // Identificar a outra parte (counterparty)
        let counterpartyId: string | null | undefined;
        if (isProvider) {
          counterpartyId = order.userId;
        } else if (isOrderOwner) {
          counterpartyId = order.providerId || order.transactions[0]?.payerId;
        } else {
          counterpartyId = order.userId;
        }

        if (counterpartyId) {
          await notificationService.notifyDisputeCreated(
            dispute.id,
            input.orderId,
            counterpartyId,
            dispute.creator.name || 'Usuário'
          );

          // Email para a contraparte
          const counterpartyUser = await prisma.user.findUnique({
            where: { id: counterpartyId },
            select: { email: true, name: true },
          });
          if (counterpartyUser?.email) {
            emailService.sendIfAllowed(counterpartyId, 'DISPUTES', () =>
              emailService.sendDisputeCreatedEmail(counterpartyUser.email, {
                name: counterpartyUser.name || 'Usuário',
                disputeTitle: dispute.title,
                crypto: dispute.order.cryptoType,
                cryptoAmount: dispute.order.cryptoAmount.toString(),
                brlAmount: dispute.order.brlAmount.toString(),
                creatorName: dispute.creator.name || 'Usuário',
              })
            ).catch(() => {});
          }
        }
      } catch (error) {
        console.error('Failed to send dispute created notification:', error);
      }
    });

    return dispute;
  }

  /**
   * Outra parte responde à disputa
   */
  async respondToDispute(userId: string, disputeId: string, input: RespondDisputeInput) {
    // Buscar disputa
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        creator: { select: { id: true, name: true } },
        order: {
          include: {
            transactions: true,
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!dispute) {
      throw new Error('Disputa não encontrada');
    }

    // Validar que usuario e a outra parte (nao o criador)
    const order = dispute.order;

    if (dispute.createdBy === userId) {
      throw new Error('Voce nao pode responder a sua propria disputa');
    }

    const isOrderOwner = order.userId === userId;
    const isPayer = order.transactions.some(t => t.payerId === userId);
    const isProvider = order.providerId === userId;

    if (!isOrderOwner && !isPayer && !isProvider) {
      throw new Error('Apenas a outra parte pode responder a disputa');
    }

    // Validar status
    if (dispute.status !== 'OPEN') {
      throw new Error('Esta disputa não está mais aberta para respostas');
    }

    // Validar deadline (24h)
    const timeSinceCreated = Date.now() - dispute.createdAt.getTime();
    if (timeSinceCreated > DISPUTE_DEADLINES.RESPONSE_TIME) {
      throw new Error('Prazo para responder expirou (48h)');
    }

    // Validar campos
    if (!input.contestation || input.contestation.length < 50) {
      throw new Error('Contestação deve ter no mínimo 50 caracteres');
    }

    // Adicionar mensagem de resposta
    await prisma.disputeMessage.create({
      data: {
        disputeId,
        authorId: userId,
        message: input.contestation,
        attachments: input.counterEvidences ? JSON.stringify(input.counterEvidences) : null,
        isAdminMessage: false,
      },
    });

    // Atualizar status para UNDER_REVIEW
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'UNDER_REVIEW',
      },
      include: {
        creator: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            type: true,
            brlAmount: true,
            cryptoAmount: true,
          },
        },
      },
    });

    // Notificar criador da disputa
    await notificationService.createNotification({
      userId: dispute.createdBy,
      type: 'DISPUTE_RESPONDED',
      category: 'DISPUTE',
      title: '💬 Resposta Recebida',
      message: 'A outra parte respondeu à disputa. Nossa equipe está analisando o caso.',
      actionUrl: `/disputes/${disputeId}`,
      actionLabel: 'Ver Disputa',
      relatedId: disputeId,
      relatedType: 'DISPUTE',
      priority: 'HIGH',
    });

    // Notificar admins
    await this.notifyAdmins(disputeId, 'Disputa precisa de análise');

    logger.info('[DISPUTE] Response added', {
      disputeId,
      respondedBy: userId,
    });

    return updatedDispute;
  }

  /**
   * Adicionar mensagem/evidência à disputa
   */
  async addMessage(input: AddMessageInput) {
    // Verificar se disputa existe
    const dispute = await prisma.dispute.findUnique({
      where: { id: input.disputeId },
      include: {
        order: true,
      },
    });

    if (!dispute) {
      throw new Error('Disputa não encontrada');
    }

    // Verificar se disputa ainda está aberta
    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
      throw new Error('Disputa já foi resolvida');
    }

    // Verificar permissão (criador, payer ou admin)
    const order = await prisma.order.findUnique({
      where: { id: dispute.orderId },
      include: { transactions: true },
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const isOrderOwner = order.userId === input.authorId;
    const isPayer = order.transactions.some(t => t.payerId === input.authorId);
    const isProvider = order.providerId === input.authorId;

    // Buscar usuário para verificar se é staff (SUPPORT+)
    const user = await prisma.user.findUnique({
      where: { id: input.authorId },
      include: {
        role: {
          select: {
            slug: true,
            level: true,
          },
        },
      },
    });

    const userLevel = user?.role?.level || 0;
    const isStaff = userLevel >= 40; // SUPPORT+ pode adicionar mensagens como staff

    if (!isOrderOwner && !isPayer && !isProvider && !isStaff) {
      throw new Error('Você não tem permissão para adicionar mensagens nesta disputa');
    }

    // Criar mensagem
    const message = await prisma.disputeMessage.create({
      data: {
        disputeId: input.disputeId,
        authorId: input.authorId,
        message: input.message,
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
        isAdminMessage: input.isAdminMessage || isStaff,
        visibleTo: isStaff ? (input.visibleTo || null) : null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Transicionar OPEN → UNDER_REVIEW quando:
    // 1. Staff adiciona mensagem, OU
    // 2. A outra parte (não o criador da disputa) envia mensagem pela primeira vez
    const isOtherParty = !isStaff && input.authorId !== dispute.createdBy;

    if (dispute.status === 'OPEN' && (isStaff || isOtherParty)) {
      await prisma.dispute.update({
        where: { id: input.disputeId },
        data: { status: 'UNDER_REVIEW' },
      });

      // Se for a outra parte respondendo, notificar criador e admins
      if (isOtherParty) {
        setImmediate(async () => {
          try {
            await notificationService.createNotification({
              userId: dispute.createdBy,
              type: 'DISPUTE_RESPONDED',
              category: 'DISPUTE',
              title: '💬 Resposta Recebida',
              message: 'A outra parte respondeu à disputa. Nossa equipe está analisando o caso.',
              actionUrl: `/disputes/${input.disputeId}`,
              actionLabel: 'Ver Disputa',
              relatedId: input.disputeId,
              relatedType: 'DISPUTE',
              priority: 'HIGH',
            });
            await this.notifyAdmins(input.disputeId, 'Disputa precisa de análise');
          } catch (err) {
            console.error('Failed to send dispute response notifications:', err);
          }
        });
      }
    }

    // Capturar valor de isStaff para usar no callback assíncrono
    const isAdmin = isStaff;

    // Enviar notificação para outras partes da disputa
    setImmediate(async () => {
      try {
        const isOrderOwner = order.userId === input.authorId;
        const isPayer = order.transactions.some(t => t.payerId === input.authorId);
        const isProvider = order.providerId === input.authorId;

        // Notificar a outra parte (não o autor da mensagem)
        let recipientId: string | null | undefined;
        if (isAdmin && input.visibleTo) {
          // Staff enviando mensagem privada → notificar o destinatário
          recipientId = input.visibleTo;
        } else if (isProvider) {
          recipientId = order.userId;
        } else if (isOrderOwner) {
          recipientId = order.providerId || order.transactions[0]?.payerId;
        } else if (isPayer) {
          recipientId = order.userId;
        } else {
          recipientId = null;
        }

        if (recipientId) {
          await notificationService.notifyDisputeMessage(
            input.disputeId,
            recipientId,
            message.author.name || 'Usuário',
            isAdmin
          );
        }
      } catch (error) {
        console.error('Failed to send dispute message notification:', error);
      }
    });

    return message;
  }

  /**
   * Resolver disputa (apenas admin)
   */
  async resolveDispute(input: ResolveDisputeInput) {
    // Verificar se usuário existe e tem nível adequado (GERENTE+)
    const user = await prisma.user.findUnique({
      where: { id: input.resolvedBy },
      include: {
        role: {
          select: {
            level: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const userLevel = user.role?.level || 0;
    if (userLevel < 60) {
      throw new Error('Você não tem permissão para resolver disputas. Requer nível GERENTE ou superior.');
    }

    // Buscar disputa
    const dispute = await prisma.dispute.findUnique({
      where: { id: input.disputeId },
      include: {
        order: true,
      },
    });

    if (!dispute) {
      throw new Error('Disputa não encontrada');
    }

    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
      throw new Error('Disputa já foi resolvida');
    }

    // Atualizar disputa
    const resolvedDispute = await prisma.dispute.update({
      where: { id: input.disputeId },
      data: {
        status: this.getResolvedStatus(input.resolutionType),
        resolvedBy: input.resolvedBy,
        resolution: input.resolution,
        resolutionType: input.resolutionType,
        resolvedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: true,
        messages: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Atualizar status do pedido baseado na resolução
    let newOrderStatus = dispute.order.status;

    switch (input.resolutionType) {
      case 'RELEASE_TO_BUYER':
      case 'PENALTY_SELLER':
        newOrderStatus = 'COMPLETED';
        break;
      case 'RETURN_TO_SELLER':
      case 'PENALTY_BUYER':
      case 'CANCEL_NO_PENALTY':
        newOrderStatus = 'CANCELLED';
        break;
      default:
        newOrderStatus = 'CANCELLED';
    }

    await prisma.order.update({
      where: { id: dispute.orderId },
      data: { status: newOrderStatus },
    });

    // Buscar dados completos do pedido para transferência de cripto
    const order = await prisma.order.findUnique({
      where: { id: dispute.orderId },
      include: { transactions: true, user: true },
    });

    if (order) {
      // Identificar vendedor/comprador baseado no tipo de ordem (BUY vs SELL)
      const isBuyOrder = order.orderType === 'BUY';
      const transaction = order.transactions[0];

      const sellerId = isBuyOrder ? order.providerId : order.userId;
      const buyerId = isBuyOrder ? order.userId : transaction?.payerId;
      const sellerWalletId = isBuyOrder ? order.providerWalletId : order.walletId;

      logger.info(`[DISPUTE] Resolução: orderType=${order.orderType}, sellerId=${sellerId}, buyerId=${buyerId}, sellerWalletId=${sellerWalletId}`);

      // ═══════════════════════════════════════════════════════════════════════
      // TRANSFERENCIA DE CRIPTO BASEADA NA RESOLUCAO
      // ═══════════════════════════════════════════════════════════════════════
      if (sellerWalletId) {
        // Usar BigNumber para evitar erros de precisao de ponto flutuante
        const cryptoAmountBN = toBN(order.cryptoAmount);
        const payerRewardBN = isBuyOrder
          ? toBN('0') // BUY orders: sem cashback
          : toBN(order.payerReward || '0'); // SELL orders: cashback
        const totalAmountBN = cryptoAmountBN.plus(payerRewardBN);
        const platformFeeBN = toBN(order.platformFee || '0');

        // Buscar carteira do vendedor (onde esta o colateral bloqueado)
        const sellerWallet = await prisma.userWallet.findUnique({
          where: { id: sellerWalletId },
        });

        if (sellerWallet) {
          const sellerLockedBalanceBN = toBN(sellerWallet.lockedBalance);

          if (input.resolutionType === 'RELEASE_TO_BUYER' || input.resolutionType === 'PENALTY_SELLER') {
            // A FAVOR DO COMPRADOR: Transferir cripto do vendedor para o comprador

            if (!buyerId) {
              logger.error(`[DISPUTE] Comprador não identificado para disputa ${input.disputeId} (order ${order.id})`);
              throw new Error('Buyer ID not found for dispute resolution');
            }

            // BUY: colateral inclui fee (crypto + 1.5%), SELL: colateral NÃO inclui fee (crypto + 1% reward)
            const totalDeductFromLockedBN = isBuyOrder
              ? totalAmountBN.plus(platformFeeBN) // BUY: totalAmount + fee vêm do locked
              : totalAmountBN;                     // SELL: só totalAmount vem do locked
            if (sellerLockedBalanceBN.lt(totalDeductFromLockedBN)) {
              logger.error(`[DISPUTE] Saldo bloqueado insuficiente: ${sellerLockedBalanceBN.toFixed(8)} < ${totalDeductFromLockedBN.toFixed(8)}`);
              throw new Error(`Insufficient locked balance for dispute resolution: ${sellerLockedBalanceBN.toFixed(8)} < ${totalDeductFromLockedBN.toFixed(8)}`);
            }

            // Buscar/criar carteira do comprador
            let buyerWallet = await prisma.userWallet.findFirst({
              where: {
                userId: buyerId,
                cryptoType: order.cryptoType,
                network: order.cryptoNetwork,
              },
            });

            if (!buyerWallet) {
              // Criar carteira para o comprador
              const { address, privateKey, derivationPath } = DerivationService.deriveUserWallet(
                buyerId,
                order.cryptoType,
                order.cryptoNetwork
              );
              const encryptedPrivateKey = KeyManagementService.encryptPrivateKey(privateKey, buyerId);

              buyerWallet = await prisma.userWallet.create({
                data: {
                  userId: buyerId,
                  cryptoType: order.cryptoType,
                  network: order.cryptoNetwork,
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
              logger.info(`[DISPUTE] Carteira criada para comprador: ${buyerWallet.address}`);
            }

            // Calcular novos saldos
            const sellerNewLockedBN = sellerLockedBalanceBN.minus(totalAmountBN);
            const sellerNewBalanceBN = toBN(sellerWallet.balance).minus(totalAmountBN);
            const buyerNewBalanceBN = toBN(buyerWallet.balance).plus(totalAmountBN);
            const buyerNewAvailableBN = toBN(buyerWallet.availableBalance).plus(totalAmountBN);

            // Pré-buscar platform wallet ANTES da transaction (reads fora, writes dentro)
            let platformWallet: any = null;
            let sellerBalanceBeforeFee: BigNumber | null = null;
            let sellerLockedBeforeFee: BigNumber | null = null;
            let sellerBalanceAfterFee: BigNumber | null = null;
            let sellerLockedAfterFee: BigNumber | null = null;
            let platformNewBalance: BigNumber | null = null;
            let currentTotalFees: BigNumber | null = null;

            if (platformFeeBN.gt(0)) {
              platformWallet = await prisma.platformWallet.findFirst({
                where: {
                  cryptoType: order.cryptoType,
                  network: order.cryptoNetwork,
                },
              });

              if (!platformWallet) {
                const { address, privateKey, derivationPath } = DerivationService.derivePlatformWallet(
                  order.cryptoType,
                  order.cryptoNetwork
                );
                const existingByAddress = await prisma.platformWallet.findFirst({
                  where: { address },
                });
                if (existingByAddress) {
                  platformWallet = existingByAddress;
                } else {
                  const encryptedPrivateKey = KeyManagementService.encryptPrivateKey(privateKey, 'PLATFORM');
                  platformWallet = await prisma.platformWallet.create({
                    data: {
                      cryptoType: order.cryptoType,
                      network: order.cryptoNetwork,
                      address,
                      derivationPath,
                      encryptedPrivateKey,
                      balance: '0',
                      isActive: true,
                    },
                  });
                }
              }

              // Pré-calcular saldos do fee (vendedor já teve totalAmount deduzido)
              // BUY: fee vem do locked (faz parte do colateral do provedor)
              // SELL: fee vem do available (NÃO faz parte do colateral)
              sellerBalanceBeforeFee = sellerNewBalanceBN;
              sellerLockedBeforeFee = sellerNewLockedBN;
              sellerBalanceAfterFee = sellerNewBalanceBN.minus(platformFeeBN);
              if (isBuyOrder) {
                sellerLockedAfterFee = sellerNewLockedBN.minus(platformFeeBN);
              } else {
                sellerLockedAfterFee = sellerNewLockedBN; // SELL: locked NÃO muda pela fee
              }
              platformNewBalance = toBN(platformWallet.balance).plus(platformFeeBN);
              currentTotalFees = toBN(platformWallet.totalFeesCollected || '0');
            }

            // Pré-calcular availableBalance para SELL orders com fee (fee vem do available)
            let sellerAvailableAfterFee: BigNumber | null = null;
            if (platformFeeBN.gt(0) && !isBuyOrder) {
              sellerAvailableAfterFee = toBN(sellerWallet.availableBalance).minus(platformFeeBN);
            }

            // Transaction atômica: todas as writes de saldo + order update
            await prisma.$transaction(async (tx) => {
              // Deduzir do vendedor (lockedBalance e balance)
              const sellerUpdateData: any = {
                balance: (platformFeeBN.gt(0) && sellerBalanceAfterFee ? sellerBalanceAfterFee : sellerNewBalanceBN).toFixed(8),
                lockedBalance: (platformFeeBN.gt(0) && sellerLockedAfterFee ? sellerLockedAfterFee : sellerNewLockedBN).toFixed(8),
              };
              // SELL com fee: atualizar availableBalance (fee vem do available, não do locked)
              if (sellerAvailableAfterFee) {
                sellerUpdateData.availableBalance = sellerAvailableAfterFee.toFixed(8);
              }
              await tx.userWallet.update({
                where: { id: sellerWallet.id },
                data: sellerUpdateData,
              });

              // Creditar no comprador (availableBalance e balance)
              await tx.userWallet.update({
                where: { id: buyerWallet.id },
                data: {
                  balance: buyerNewBalanceBN.toFixed(8),
                  availableBalance: buyerNewAvailableBN.toFixed(8),
                },
              });

              // Registrar WalletTransaction DEDUCT (vendedor)
              await tx.walletTransaction.create({
                data: {
                  walletId: sellerWallet.id,
                  userId: sellerWallet.userId,
                  orderId: order.id,
                  type: 'DEDUCT',
                  amount: totalAmountBN.toFixed(8),
                  balanceBefore: sellerWallet.balance,
                  balanceAfter: sellerNewBalanceBN.toFixed(8),
                  lockedBefore: sellerWallet.lockedBalance,
                  lockedAfter: sellerNewLockedBN.toFixed(8),
                  description: `Disputa resolvida - Cripto transferida ao comprador (Order ${order.id})`,
                  metadata: JSON.stringify({
                    disputeId: input.disputeId,
                    resolutionType: input.resolutionType,
                    buyerId,
                    buyerWalletId: buyerWallet.id,
                  }),
                },
              });

              // Registrar WalletTransaction CREDIT (comprador)
              await tx.walletTransaction.create({
                data: {
                  walletId: buyerWallet.id,
                  userId: buyerWallet.userId,
                  orderId: order.id,
                  type: 'CREDIT',
                  amount: totalAmountBN.toFixed(8),
                  balanceBefore: buyerWallet.balance,
                  balanceAfter: buyerNewBalanceBN.toFixed(8),
                  description: `Disputa resolvida - Cripto recebida do vendedor (Order ${order.id})`,
                  metadata: JSON.stringify({
                    disputeId: input.disputeId,
                    resolutionType: input.resolutionType,
                    sellerId,
                    sellerWalletId: sellerWallet.id,
                  }),
                },
              });

              // Platform fee (se houver)
              if (platformFeeBN.gt(0) && platformWallet && sellerBalanceBeforeFee && sellerLockedBeforeFee && sellerBalanceAfterFee && sellerLockedAfterFee && platformNewBalance && currentTotalFees) {
                // Creditar na carteira da plataforma
                await tx.platformWallet.update({
                  where: { id: platformWallet.id },
                  data: {
                    balance: platformNewBalance.toFixed(8),
                    totalFeesCollected: currentTotalFees.plus(platformFeeBN).toFixed(8),
                  },
                });

                // Registrar WalletTransaction PLATFORM_FEE
                await tx.walletTransaction.create({
                  data: {
                    walletId: sellerWallet.id,
                    userId: sellerWallet.userId,
                    orderId: order.id,
                    type: 'PLATFORM_FEE',
                    amount: platformFeeBN.toFixed(8),
                    balanceBefore: sellerBalanceBeforeFee.toFixed(8),
                    balanceAfter: sellerBalanceAfterFee.toFixed(8),
                    lockedBefore: sellerLockedBeforeFee.toFixed(8),
                    lockedAfter: sellerLockedAfterFee.toFixed(8),
                    description: `Disputa resolvida - Platform fee (Order ${order.id})`,
                    metadata: JSON.stringify({
                      disputeId: input.disputeId,
                      platformWalletId: platformWallet.id,
                      platformFee: platformFeeBN.toFixed(8),
                      feeSource: isBuyOrder ? 'locked' : 'available',
                    }),
                  },
                });

                // Registrar movimentação no ledger da platform wallet
                await PlatformWalletService.recordMovement(tx, {
                  platformWalletId: platformWallet.id,
                  type: 'FEE_RECEIVED',
                  direction: 'IN',
                  amount: platformFeeBN.toFixed(8),
                  balanceBefore: platformWallet.balance,
                  balanceAfter: platformNewBalance.toFixed(8),
                  description: `Fee recebida via disputa ${input.disputeId} (Order ${order.id})`,
                  orderId: order.id,
                  userId: sellerWallet.userId,
                  metadata: {
                    disputeId: input.disputeId,
                    orderType: isBuyOrder ? 'BUY' : 'SELL',
                    cryptoType: order.cryptoType,
                    network: order.network,
                  },
                });

                logger.info(`[DISPUTE] Platform fee transferida: ${platformFeeBN.toFixed(8)} ${order.cryptoType}`);
              }

              // Marcar pedido como transferido
              await tx.order.update({
                where: { id: order.id },
                data: {
                  cryptoTransferred: true,
                  cryptoTransferredAt: new Date(),
                  cryptoTransferredTo: buyerId,
                  collateralLocked: false,
                  collateralUnlockedAt: new Date(),
                },
              });
            });

            logger.info(`[DISPUTE] Cripto transferida para comprador: ${totalAmountBN.toFixed(8)} ${order.cryptoType}`);

          } else if (input.resolutionType === 'RETURN_TO_SELLER' || input.resolutionType === 'PENALTY_BUYER' || input.resolutionType === 'CANCEL_NO_PENALTY') {
            // A FAVOR DO VENDEDOR ou CANCELAMENTO: Desbloquear cripto para o vendedor
            // Usar collateralLockedAmount (valor exato que foi travado), como faz o cancelamento normal
            const collateralLockedBN = toBN(order.collateralLockedAmount || '0');
            const totalToUnlock = collateralLockedBN.gt(0)
              ? collateralLockedBN
              : (isBuyOrder ? totalAmountBN.plus(platformFeeBN) : totalAmountBN);  // fallback para ordens antigas
            const amountToUnlock = sellerLockedBalanceBN.lt(totalToUnlock) ? sellerLockedBalanceBN : totalToUnlock;

            const sellerNewLockedBN = sellerLockedBalanceBN.minus(amountToUnlock);
            const sellerNewAvailableBN = toBN(sellerWallet.availableBalance).plus(amountToUnlock);

            // Transaction atômica: unlock + WalletTransaction + order update
            await prisma.$transaction(async (tx) => {
              // Mover de lockedBalance para availableBalance
              await tx.userWallet.update({
                where: { id: sellerWallet.id },
                data: {
                  lockedBalance: sellerNewLockedBN.toFixed(8),
                  availableBalance: sellerNewAvailableBN.toFixed(8),
                },
              });

              // Registrar WalletTransaction UNLOCK
              await tx.walletTransaction.create({
                data: {
                  walletId: sellerWallet.id,
                  userId: sellerWallet.userId,
                  orderId: order.id,
                  type: 'UNLOCK',
                  amount: amountToUnlock.toFixed(8),
                  balanceBefore: sellerWallet.balance,
                  balanceAfter: sellerWallet.balance, // balance total não muda, só locked→available
                  lockedBefore: sellerWallet.lockedBalance,
                  lockedAfter: sellerNewLockedBN.toFixed(8),
                  description: `Disputa resolvida - Colateral desbloqueado (Order ${order.id})`,
                  metadata: JSON.stringify({
                    disputeId: input.disputeId,
                    resolutionType: input.resolutionType,
                  }),
                },
              });

              // Marcar pedido como desbloqueado (nao transferido)
              await tx.order.update({
                where: { id: order.id },
                data: {
                  collateralLocked: false,
                  collateralUnlockedAt: new Date(),
                  cryptoTransferred: false,
                },
              });
            });

            const action = input.resolutionType === 'CANCEL_NO_PENALTY' ? 'Cancelamento' : 'Devolvida ao vendedor';
            logger.info(`[DISPUTE] ${action}: ${amountToUnlock.toFixed(8)} ${order.cryptoType}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // RECALCULAR REPUTACAO COMPOSTA PARA AMBAS AS PARTES
      // ═══════════════════════════════════════════════════════════════════════
      // O ReputationService calcula disputas ganhas/perdidas automaticamente
      // a partir dos status RESOLVED_BUYER/RESOLVED_SELLER
      {
        const { reputationService } = await import('./reputation.service');

        if (input.resolutionType !== 'CANCEL_NO_PENALTY') {
          if (sellerId) {
            const newScore = await reputationService.recalculateAndSave(sellerId);
            logger.info(`[DISPUTE REPUTATION] Vendedor ${sellerId}: recalculado → ${newScore}`);
          }
          if (buyerId) {
            const newScore = await reputationService.recalculateAndSave(buyerId);
            logger.info(`[DISPUTE REPUTATION] Comprador ${buyerId}: recalculado → ${newScore}`);
          }
        }
      }
      // CANCEL_NO_PENALTY não aplica penalidade a ninguém
    }

    // Adicionar mensagem de resolução
    const resolutionLabels: Record<string, string> = {
      'RELEASE_TO_BUYER': '✅ Cripto liberada para o pagador do PIX',
      'RETURN_TO_SELLER': '↩️ Cripto devolvida ao vendedor',
      'CANCEL_NO_PENALTY': '🤝 Negociação cancelada sem penalidades',
      'PENALTY_BUYER': '🚫 Cripto devolvida ao vendedor + Penalidade ao comprador',
      'PENALTY_SELLER': '🚫 Cripto liberada ao comprador + Penalidade ao vendedor',
    };

    await prisma.disputeMessage.create({
      data: {
        disputeId: input.disputeId,
        authorId: input.resolvedBy,
        message: `Disputa resolvida: ${resolutionLabels[input.resolutionType] || input.resolutionType}\n\nJustificativa: ${input.resolution}`,
        isAdminMessage: true,
      },
    });

    // Enviar notificações para ambas as partes
    setImmediate(async () => {
      try {
        const order = await prisma.order.findUnique({
          where: { id: dispute.orderId },
          include: { transactions: true },
        });

        if (order) {
          // Notificar criador da disputa
          await notificationService.notifyDisputeResolved(
            input.disputeId,
            dispute.createdBy,
            input.resolution,
            input.resolutionType
          );

          // Notificar a outra parte
          const isCreatorOrderOwner = order.userId === dispute.createdBy;
          const counterpartyId = isCreatorOrderOwner
            ? order.transactions[0]?.payerId
            : order.userId;

          if (counterpartyId) {
            await notificationService.notifyDisputeResolved(
              input.disputeId,
              counterpartyId,
              input.resolution,
              input.resolutionType
            );
          }

          // Emails de resolução para ambas as partes
          const emailParams = {
            disputeTitle: resolvedDispute.title || 'Disputa',
            resolution: input.resolution,
            resolutionType: input.resolutionType,
          };
          if (resolvedDispute.creator?.email) {
            emailService.sendIfAllowed(resolvedDispute.createdBy, 'DISPUTES', () =>
              emailService.sendDisputeResolvedEmail(resolvedDispute.creator.email, {
                name: resolvedDispute.creator.name || 'Usuário', ...emailParams,
              })
            ).catch(() => {});
          }
          if (counterpartyId) {
            const counterpartyUser = await prisma.user.findUnique({
              where: { id: counterpartyId },
              select: { email: true, name: true },
            });
            if (counterpartyUser?.email) {
              emailService.sendIfAllowed(counterpartyId, 'DISPUTES', () =>
                emailService.sendDisputeResolvedEmail(counterpartyUser.email, {
                  name: counterpartyUser.name || 'Usuário', ...emailParams,
                })
              ).catch(() => {});
            }
          }
        }
      } catch (error) {
        console.error('Failed to send dispute resolved notifications:', error);
      }
    });

    return resolvedDispute;
  }

  /**
   * Buscar disputa por ID
   * @param disputeId ID da disputa
   * @param requesterId ID do usuário que está fazendo a requisição (para filtro de privacidade)
   */
  async getDisputeById(disputeId: string, requesterId?: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            transactions: {
              include: {
                payer: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        transaction: true,
        messages: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!dispute) return null;

    // Incluir dados do provider para ordens BUY
    if (dispute.order.providerId) {
      const provider = await prisma.user.findUnique({
        where: { id: dispute.order.providerId },
        select: { id: true, name: true, email: true },
      });
      (dispute.order as any).provider = provider;
    }

    // Filtrar mensagens por privacidade
    if (requesterId) {
      // Verificar se requester é staff (SUPPORT+ level >= 40)
      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        include: { role: { select: { level: true } } },
      });

      const isStaff = (requester?.role?.level || 0) >= 40;

      if (!isStaff) {
        // Usuário normal: ver suas próprias mensagens + mensagens de admin destinadas a ele
        dispute.messages = dispute.messages.filter((msg) => {
          // Mensagens do próprio usuário
          if (msg.authorId === requesterId) return true;
          // Mensagens de admin: só se visibleTo é null (para todos) ou para este usuário
          if (msg.isAdminMessage) {
            return !msg.visibleTo || msg.visibleTo === requesterId;
          }
          return false;
        });
      }
      // Staff vê todas as mensagens (sem filtro)
    }

    return dispute;
  }

  /**
   * Listar disputas do usuário
   */
  async getUserDisputes(userId: string) {
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { order: { userId: userId } },
          { order: { transactions: { some: { payerId: userId } } } },
          { order: { providerId: userId } },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            type: true,
            orderType: true,
            status: true,
            brlAmount: true,
            cryptoAmount: true,
            cryptoType: true,
            userId: true,
            providerId: true,
            user: {
              select: { id: true, name: true },
            },
            transactions: {
              select: {
                payerId: true,
                payer: {
                  select: { id: true, name: true },
                },
              },
              take: 1,
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Buscar nomes dos providers (providerId nao tem relacao Prisma)
    const providerIds = [...new Set(disputes.map(d => d.order.providerId).filter(Boolean))] as string[];
    const providers = providerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, name: true },
        })
      : [];
    const providerMap = Object.fromEntries(providers.map(p => [p.id, p.name]));

    return disputes.map(d => ({
      ...d,
      order: {
        ...d.order,
        providerName: d.order.providerId ? providerMap[d.order.providerId] || null : null,
      },
    }));
  }

  /**
   * Listar todas as disputas (admin)
   */
  async getAllDisputes(filters?: {
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          resolver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              type: true,
              status: true,
              brlAmount: true,
              cryptoAmount: true,
              cryptoType: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.dispute.count({ where }),
    ]);

    return { disputes, total };
  }

  /**
   * Estatísticas de disputas (admin)
   */
  async getDisputeStats() {
    const [
      total,
      open,
      underReview,
      resolvedBuyer,
      resolvedSeller,
      cancelled,
      byCategory,
      byResolutionType,
      recentDisputes,
    ] = await Promise.all([
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.dispute.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.dispute.count({ where: { status: 'RESOLVED_BUYER' } }),
      prisma.dispute.count({ where: { status: 'RESOLVED_SELLER' } }),
      prisma.dispute.count({ where: { status: 'CANCELLED' } }),
      prisma.dispute.groupBy({
        by: ['category'],
        _count: true,
        orderBy: {
          _count: {
            category: 'desc',
          },
        },
      }),
      prisma.dispute.groupBy({
        by: ['resolutionType'],
        where: {
          resolutionType: { not: null },
        },
        _count: true,
        orderBy: {
          _count: {
            resolutionType: 'desc',
          },
        },
      }),
      prisma.dispute.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    const resolved = resolvedBuyer + resolvedSeller + cancelled;

    return {
      total,
      open,
      underReview,
      resolved,
      resolvedBuyer,
      resolvedSeller,
      cancelled,
      recent: recentDisputes,
      byCategory,
      byResolutionType,
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
    };
  }

  /**
   * Analytics de disputas por período
   */
  async getDisputeAnalytics(days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const disputes = await prisma.dispute.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        status: true,
        category: true,
        resolutionType: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    // Calculate average resolution time
    const resolvedDisputes = disputes.filter(d => d.resolvedAt);
    const avgResolutionTime = resolvedDisputes.length > 0
      ? resolvedDisputes.reduce((sum, d) => {
          const time = d.resolvedAt!.getTime() - d.createdAt.getTime();
          return sum + time;
        }, 0) / resolvedDisputes.length
      : 0;

    // Group by status
    const byStatus = disputes.reduce((acc: any, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});

    // Group by category
    const byCategory = disputes.reduce((acc: any, d) => {
      acc[d.category] = (acc[d.category] || 0) + 1;
      return acc;
    }, {});

    return {
      period: `${days} days`,
      totalDisputes: disputes.length,
      avgResolutionTimeHours: avgResolutionTime / (1000 * 60 * 60),
      byStatus,
      byCategory,
      resolvedCount: resolvedDisputes.length,
      resolutionRate: disputes.length > 0 ? (resolvedDisputes.length / disputes.length) * 100 : 0,
    };
  }

  /**
   * Top disputantes (usuários com mais disputas)
   */
  async getTopDisputants(limit: number = 10) {
    const disputes = await prisma.dispute.findMany({
      select: {
        createdBy: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            reputationScore: true,
          },
        },
      },
    });

    const userCounts = disputes.reduce((acc: any, d) => {
      const userId = d.createdBy;
      if (!acc[userId]) {
        acc[userId] = {
          user: d.creator,
          count: 0,
        };
      }
      acc[userId].count += 1;
      return acc;
    }, {});

    return Object.values(userCounts)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Helper: Converter resolutionType em status
   */
  private getResolvedStatus(resolutionType: string): string {
    switch (resolutionType) {
      case 'RELEASE_TO_BUYER':
        return 'RESOLVED_BUYER';  // Liberar cripto para comprador
      case 'RETURN_TO_SELLER':
        return 'RESOLVED_SELLER'; // Devolver cripto para vendedor
      case 'CANCEL_NO_PENALTY':
        return 'CANCELLED';       // Cancelamento sem penalidade
      case 'PENALTY_BUYER':
        return 'RESOLVED_SELLER'; // Penaliza comprador = favor vendedor
      case 'PENALTY_SELLER':
        return 'RESOLVED_BUYER';  // Penaliza vendedor = favor comprador
      default:
        return 'RESOLVED_BUYER';
    }
  }

  /**
   * Helper: Ajustar reputação de usuário
   */
  private async adjustReputation(userId: string, adjustment: number, reason: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });

    if (!user) return;

    const newScore = Math.max(0, user.reputationScore + adjustment); // Não pode ser negativo

    await prisma.user.update({
      where: { id: userId },
      data: { reputationScore: newScore },
    });

    logger.info('[REPUTATION] Adjusted', {
      userId,
      adjustment,
      newScore,
      reason,
    });
  }

  /**
   * Helper: Notificar todos os admins
   */
  private async notifyAdmins(disputeId: string, message: string) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MASTER'] } },
      select: { id: true },
    });

    for (const admin of admins) {
      await notificationService.createNotification({
        userId: admin.id,
        type: 'ADMIN_DISPUTE',
        category: 'DISPUTE',
        title: '🚨 Disputa Precisa de Análise',
        message,
        actionUrl: `/admin/disputes/${disputeId}`,
        actionLabel: 'Analisar',
        relatedId: disputeId,
        relatedType: 'DISPUTE',
        priority: 'HIGH',
      });
    }
  }
}

export const disputeService = new DisputeService();
