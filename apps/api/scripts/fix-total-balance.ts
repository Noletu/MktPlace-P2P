/**
 * Script para Corrigir Saldo Total (Debitar Gastos)
 *
 * PROBLEMA:
 * - Pedidos COMPLETED tiveram saldo desbloqueado MAS não debitado do total
 * - balance (total) ainda mostra valor antigo
 * - totalUsed não foi atualizado
 *
 * SOLUÇÃO:
 * - Recalcular balance = deposits - used
 * - Atualizar totalUsed
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Iniciando correção de saldo total...\n');

  // Buscar todos os saldos
  const balances = await prisma.internalBalance.findMany({
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  console.log(`📊 Total de saldos encontrados: ${balances.length}\n`);

  for (const balance of balances) {
    console.log(`${'='.repeat(80)}`);
    console.log(`👤 Usuário: ${balance.user.email}`);
    console.log(`💰 Cripto: ${balance.cryptoType} (${balance.network})`);
    console.log(`${'='.repeat(80)}\n`);

    // Buscar TODAS as transações de colateral
    const transactions = await prisma.collateralTransaction.findMany({
      where: {
        balanceId: balance.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`📝 Total de transações: ${transactions.length}\n`);

    // Calcular saldo correto baseado em transações
    let calculatedBalance = 0;
    let totalDeposited = 0;
    let totalLocked = 0;
    let totalUnlocked = 0;
    let totalDeducted = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);

      switch (tx.type) {
        case 'DEPOSIT':
          calculatedBalance += amount;
          totalDeposited += amount;
          console.log(`   💰 DEPOSIT: +${amount.toFixed(8)} (total: ${calculatedBalance.toFixed(8)})`);
          break;

        case 'LOCK':
          // LOCK não altera balance, apenas move de available para locked
          totalLocked += amount;
          console.log(`   🔒 LOCK: ${amount.toFixed(8)} (total: ${calculatedBalance.toFixed(8)})`);
          break;

        case 'UNLOCK':
          // UNLOCK não altera balance, apenas move de locked para available
          totalUnlocked += amount;
          console.log(`   🔓 UNLOCK: ${amount.toFixed(8)} (total: ${calculatedBalance.toFixed(8)})`);
          break;

        case 'DEDUCT':
          // DEDUCT diminui o balance total (gastar)
          calculatedBalance -= amount;
          totalDeducted += amount;
          console.log(`   💸 DEDUCT: -${amount.toFixed(8)} (total: ${calculatedBalance.toFixed(8)})`);
          break;

        case 'REFUND':
          // REFUND aumenta o balance
          calculatedBalance += amount;
          console.log(`   ↩️  REFUND: +${amount.toFixed(8)} (total: ${calculatedBalance.toFixed(8)})`);
          break;
      }
    }

    const currentBalance = parseFloat(balance.balance);
    const currentTotalDeposited = parseFloat(balance.totalDeposited);
    const currentTotalUsed = parseFloat(balance.totalUsed);

    console.log(`\n📊 COMPARAÇÃO:`);
    console.log(`   Balance ATUAL: ${currentBalance.toFixed(8)} BTC`);
    console.log(`   Balance CALCULADO: ${calculatedBalance.toFixed(8)} BTC`);
    console.log(`   Diferença: ${(currentBalance - calculatedBalance).toFixed(8)} BTC\n`);

    console.log(`   TotalDeposited ATUAL: ${currentTotalDeposited.toFixed(8)} BTC`);
    console.log(`   TotalDeposited CALCULADO: ${totalDeposited.toFixed(8)} BTC\n`);

    console.log(`   TotalUsed ATUAL: ${currentTotalUsed.toFixed(8)} BTC`);
    console.log(`   TotalUsed CALCULADO (DEDUCT): ${totalDeducted.toFixed(8)} BTC\n`);

    const tolerance = 0.00000001;
    const needsCorrection = Math.abs(currentBalance - calculatedBalance) > tolerance;

    if (needsCorrection) {
      console.log(`⚠️  INCONSISTÊNCIA DETECTADA! Corrigindo...\n`);

      // Atualizar saldo
      await prisma.internalBalance.update({
        where: { id: balance.id },
        data: {
          balance: calculatedBalance.toFixed(8),
          totalDeposited: totalDeposited.toFixed(8),
          totalUsed: totalDeducted.toFixed(8),
          availableAmount: (calculatedBalance - parseFloat(balance.lockedAmount)).toFixed(8),
        },
      });

      console.log(`✅ Saldo corrigido:`);
      console.log(`   Balance: ${currentBalance.toFixed(8)} → ${calculatedBalance.toFixed(8)}`);
      console.log(`   TotalDeposited: ${currentTotalDeposited.toFixed(8)} → ${totalDeposited.toFixed(8)}`);
      console.log(`   TotalUsed: ${currentTotalUsed.toFixed(8)} → ${totalDeducted.toFixed(8)}\n`);
    } else {
      console.log(`✅ Saldo está CORRETO! Nenhuma alteração necessária.\n`);
    }
  }

  console.log(`\n✅ Correção de saldo total finalizada!\n`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
