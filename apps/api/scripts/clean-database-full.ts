/**
 * Script de Limpeza Completa do Banco de Dados
 *
 * Este script limpa TODOS os dados do banco, preservando apenas:
 * - Usuários MASTER e ADMIN
 * - Estrutura do banco (schema e migrations)
 *
 * ATENÇÃO: Esta operação é IRREVERSÍVEL!
 * Um backup automático é criado antes da limpeza.
 *
 * Uso:
 *   npm run db:clean
 *
 * @author MktPlace P2P Team
 * @date 2025-11-08
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper para logs coloridos
const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

/**
 * Cria backup do banco de dados
 */
async function createBackup(): Promise<string | null> {
  try {
    const dbPath = path.join(__dirname, '../prisma/dev.db');

    if (!fs.existsSync(dbPath)) {
      log.warning('Banco de dados não encontrado. Pulando backup.');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(__dirname, `../prisma/dev.db.backup-${timestamp}`);

    fs.copyFileSync(dbPath, backupPath);

    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    log.success(`Backup criado: ${path.basename(backupPath)} (${sizeMB} MB)`);
    return backupPath;
  } catch (error) {
    log.error(`Erro ao criar backup: ${error}`);
    throw error;
  }
}

/**
 * Conta registros antes da limpeza
 */
async function countRecords() {
  log.title('📊 CONTANDO REGISTROS ATUAIS');

  const counts = {
    users: await prisma.user.count(),
    wallets: await prisma.userWallet.count(),
    orders: await prisma.order.count(),
    transactions: await prisma.transaction.count(),
    chats: await prisma.chat.count(),
    chatMessages: await prisma.chatMessage.count(),
    notifications: await prisma.notification.count(),
    disputes: await prisma.dispute.count(),
    reviews: await prisma.review.count(),
    platformWallets: await prisma.platformWallet.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log(`  Usuários: ${counts.users}`);
  console.log(`  Carteiras: ${counts.wallets}`);
  console.log(`  Pedidos: ${counts.orders}`);
  console.log(`  Transações: ${counts.transactions}`);
  console.log(`  Chats: ${counts.chats}`);
  console.log(`  Mensagens: ${counts.chatMessages}`);
  console.log(`  Notificações: ${counts.notifications}`);
  console.log(`  Disputas: ${counts.disputes}`);
  console.log(`  Avaliações: ${counts.reviews}`);
  console.log(`  Carteiras Plataforma: ${counts.platformWallets}`);
  console.log(`  Logs Auditoria: ${counts.auditLogs}`);

  return counts;
}

/**
 * Executa limpeza completa do banco
 */
async function cleanDatabase() {
  log.title('🧹 INICIANDO LIMPEZA DO BANCO DE DADOS');

  try {
    // Usar transação para garantir atomicidade
    await prisma.$transaction(async (tx) => {

      // NÍVEL 6: Dependências mais profundas
      log.info('Limpando nível 6 (ChatArchive, ChatMessage, DisputeMessage, Fee)...');
      await tx.chatArchive.deleteMany({});
      await tx.chatMessage.deleteMany({});
      await tx.disputeMessage.deleteMany({});
      await tx.fee.deleteMany({});
      log.success('Nível 6 limpo');

      // NÍVEL 5: Dependem de Order/Transaction/Dispute
      log.info('Limpando nível 5 (Notification, Chat, Review, Dispute)...');
      await tx.notification.deleteMany({});
      await tx.chat.deleteMany({});
      await tx.review.deleteMany({});
      await tx.dispute.deleteMany({});      log.success('Nível 5 limpo');

      // NÍVEL 4: Transações
      log.info('Limpando nível 4 (Transaction)...');
      await tx.transaction.deleteMany({});
      log.success('Nível 4 limpo');

      // NÍVEL 3: Pedidos
      log.info('Limpando nível 3 (Order)...');
      await tx.order.deleteMany({});
      log.success('Nível 3 limpo');

      // NÍVEL 2: Carteiras e Transações
      log.info('Limpando nível 2 (WalletTransaction, Withdrawal, UserWallet)...');
      await tx.walletTransaction.deleteMany({});
      await tx.withdrawal.deleteMany({});
      await tx.userWallet.deleteMany({});
      log.success('Nível 2 limpo');

      // NÍVEL 1: Dados de Usuário
      log.info('Limpando nível 1 (KYCVerification, UserKeys, RefreshToken, AdminAction, CancellationHistory)...');

      // Primeiro buscar IDs dos usuários que NÃO são admin
      const nonAdminUsers = await tx.user.findMany({
        where: {
          role: { notIn: ['MASTER', 'ADMIN'] }
        },
        select: { id: true }
      });
      const nonAdminUserIds = nonAdminUsers.map(u => u.id);

      // Deletar apenas dados de usuários não-admin
      if (nonAdminUserIds.length > 0) {
        await tx.kYCVerification.deleteMany({
          where: { userId: { in: nonAdminUserIds } }
        });
        await tx.userKeys.deleteMany({
          where: { userId: { in: nonAdminUserIds } }
        });
        await tx.refreshToken.deleteMany({
          where: { userId: { in: nonAdminUserIds } }
        });
      }

      // CancellationHistory tem FK para User, então deletar apenas de usuários não-admin
      if (nonAdminUserIds.length > 0) {
        await tx.cancellationHistory.deleteMany({
          where: { userId: { in: nonAdminUserIds } }
        });
      }

      // AdminAction pode ser totalmente limpo (conforme escolha do usuário)
      await tx.adminAction.deleteMany({});

      log.success('Nível 1 limpo');

      // NÍVEL 0: Sistema e Independentes
      log.info('Limpando nível 0 (PlatformWallet, PriceQuote, PhoneVerificationCode, AuditLog)...');      await tx.platformWallet.deleteMany({});
      await tx.priceQuote.deleteMany({});
      await tx.phoneVerificationCode.deleteMany({});
      await tx.auditLog.deleteMany({});
      log.success('Nível 0 limpo');

      // ESPECIAL: Usuários (deletar apenas não-admin)
      log.info('Limpando usuários comuns (preservando MASTER e ADMIN)...');
      const deletedUsers = await tx.user.deleteMany({
        where: {
          role: { notIn: ['MASTER', 'ADMIN'] }
        }
      });
      log.success(`${deletedUsers.count} usuários comuns deletados`);

    }, {
      maxWait: 30000, // 30 segundos
      timeout: 60000, // 60 segundos
    });

    log.success('Limpeza concluída com sucesso!');

  } catch (error) {
    log.error('Erro durante a limpeza:');
    console.error(error);
    throw error;
  }
}

/**
 * Verifica resultado final
 */
async function verifyCleanup() {
  log.title('🔍 VERIFICANDO RESULTADO');

  const adminUsers = await prisma.user.findMany({
    where: {
      role: { in: ['MASTER', 'ADMIN'] }
    },
    select: {
      email: true,
      role: true,
      name: true,
    }
  });

  const totalUsers = await prisma.user.count();
  const totalOrders = await prisma.order.count();
  const totalTransactions = await prisma.transaction.count();
  const totalNotifications = await prisma.notification.count();

  console.log(`  Total de usuários: ${totalUsers}`);
  console.log(`  Usuários preservados:`);
  adminUsers.forEach(user => {
    console.log(`    - ${user.email} (${user.role})`);
  });
  console.log(`  Total de pedidos: ${totalOrders}`);
  console.log(`  Total de transações: ${totalTransactions}`);
  console.log(`  Total de notificações: ${totalNotifications}`);

  if (totalUsers === adminUsers.length && totalOrders === 0 && totalTransactions === 0) {
    log.success('✨ Banco limpo com sucesso! Apenas admins preservados.');
    return true;
  } else {
    log.warning('⚠ Verificação inconsistente. Revisar manualmente.');
    return false;
  }
}

/**
 * Main
 */
async function main() {
  console.clear();
  log.title('🗑️  LIMPEZA COMPLETA DO BANCO DE DADOS - MKTPLACE P2P');

  log.warning('═'.repeat(70));
  log.warning('  ATENÇÃO: Esta operação irá DELETAR TODOS os dados do banco!');
  log.warning('  Preservando apenas: Usuários MASTER e ADMIN');
  log.warning('  Um backup será criado automaticamente.');
  log.warning('═'.repeat(70));

  try {
    // 1. Contar registros atuais
    await countRecords();

    // 2. Criar backup
    log.title('💾 CRIANDO BACKUP');
    const backupPath = await createBackup();

    // 3. Limpar banco
    await cleanDatabase();

    // 4. Verificar resultado
    await verifyCleanup();

    // 5. Informações finais
    log.title('📋 INFORMAÇÕES IMPORTANTES');
    console.log(`  Backup salvo em: ${backupPath}`);
    console.log('');
    console.log('  Credenciais disponíveis:');
    console.log('  ┌─────────────────────────────────────┐');
    console.log('  │ Master:                             │');
    console.log('  │   Email: master@mktplace.com        │');
    console.log('  │   Senha: Master@2025!               │');
    console.log('  │                                     │');
    console.log('  │ Admin:                              │');
    console.log('  │   Email: admin@mktplace.com         │');
    console.log('  │   Senha: Admin@123                  │');
    console.log('  └─────────────────────────────────────┘');
    console.log('');
    log.info('Para restaurar o backup:');
    console.log(`  cd apps/api/prisma`);
    console.log(`  copy "${path.basename(backupPath!)}" dev.db`);
    console.log('');
    log.success('🎉 Limpeza completa! Sistema pronto para testes do zero.');

  } catch (error) {
    log.error('❌ Erro durante a limpeza do banco de dados');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main();
