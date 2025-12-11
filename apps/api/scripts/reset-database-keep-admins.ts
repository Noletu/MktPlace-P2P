import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Script para resetar banco de dados mantendo apenas usuários MASTER e ADMIN
 *
 * IMPORTANTE: Este script:
 * 1. Limpa TODOS os dados do banco
 * 2. Mantém apenas 2 usuários: master@admin.com e admin@admin.com
 * 3. Reseta senhas para padrão: Admin@123
 * 4. Remove todas as carteiras, ordens, transações, etc
 */

async function main() {
  console.log('🗑️  RESET DATABASE - Mantendo apenas usuários MASTER e ADMIN\n');

  try {
    // 1. Buscar IDs dos usuários master e admin
    const masterUser = await prisma.user.findFirst({
      where: { role: 'MASTER' },
    });

    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        email: { not: masterUser?.email || '' }
      },
    });

    if (!masterUser) {
      console.error('❌ Usuário MASTER não encontrado!');
      process.exit(1);
    }

    console.log(`✅ Usuário MASTER encontrado: ${masterUser.email} (ID: ${masterUser.id})`);
    console.log(`✅ Usuário ADMIN encontrado: ${adminUser?.email || 'N/A'} (ID: ${adminUser?.id || 'N/A'})\n`);

    // 2. Contar dados atuais
    const counts = {
      users: await prisma.user.count(),
      userWallets: await prisma.userWallet.count(),
      orders: await prisma.order.count(),
      disputes: await prisma.dispute.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log('📊 Estado atual do banco:');
    console.log(`   - Usuários: ${counts.users}`);
    console.log(`   - User Wallets: ${counts.userWallets}`);
    console.log(`   - Ordens: ${counts.orders}`);
    console.log(`   - Disputas: ${counts.disputes}`);
    console.log(`   - Audit Logs: ${counts.auditLogs}\n`);

    // 3. Deletar tudo EXCETO master e admin
    console.log('🗑️  Deletando dados...\n');

    // Disputas
    const deletedDisputes = await prisma.dispute.deleteMany();
    console.log(`   ✅ Disputas deletadas: ${deletedDisputes.count}`);

    // Ordens
    const deletedOrders = await prisma.order.deleteMany();
    console.log(`   ✅ Ordens deletadas: ${deletedOrders.count}`);

    // User Wallets
    const deletedWallets = await prisma.userWallet.deleteMany();
    console.log(`   ✅ User Wallets deletadas: ${deletedWallets.count}`);

    // Audit Logs
    const deletedAuditLogs = await prisma.auditLog.deleteMany();
    console.log(`   ✅ Audit Logs deletados: ${deletedAuditLogs.count}`);

    // Usuários (exceto master e admin)
    const userIdsToKeep = [masterUser.id];
    if (adminUser) {
      userIdsToKeep.push(adminUser.id);
    }

    const deletedUsers = await prisma.user.deleteMany({
      where: {
        id: { notIn: userIdsToKeep },
      },
    });
    console.log(`   ✅ Usuários deletados: ${deletedUsers.count}`);

    // 4. Resetar senhas dos admins para padrão
    console.log('\n🔐 Resetando senhas...\n');

    const defaultPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await prisma.user.update({
      where: { id: masterUser.id },
      data: { password: hashedPassword },
    });
    console.log(`   ✅ Senha do MASTER resetada para: ${defaultPassword}`);

    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { password: hashedPassword },
      });
      console.log(`   ✅ Senha do ADMIN resetada para: ${defaultPassword}`);
    }

    // 5. Resultado final
    const finalCounts = {
      users: await prisma.user.count(),
      userWallets: await prisma.userWallet.count(),
      orders: await prisma.order.count(),
      disputes: await prisma.dispute.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log('\n✅ RESET COMPLETO!\n');
    console.log('📊 Estado final do banco:');
    console.log(`   - Usuários: ${finalCounts.users}`);
    console.log(`   - User Wallets: ${finalCounts.userWallets}`);
    console.log(`   - Ordens: ${finalCounts.orders}`);
    console.log(`   - Disputas: ${finalCounts.disputes}`);
    console.log(`   - Audit Logs: ${finalCounts.auditLogs}\n`);

    console.log('🔑 Credenciais:');
    console.log(`   MASTER: ${masterUser.email} / ${defaultPassword}`);
    if (adminUser) {
      console.log(`   ADMIN:  ${adminUser.email} / ${defaultPassword}`);
    }

  } catch (error) {
    console.error('\n❌ Erro ao resetar banco:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
