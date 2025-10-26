/**
 * Script para Corrigir totalUsed
 *
 * PROBLEMA:
 * - totalUsed está duplicado (0.00194002 em vez de 0.00097001)
 * - Deve refletir a soma de todas as transações DEDUCT
 *
 * SOLUÇÃO:
 * - Recalcular totalUsed baseado em transações DEDUCT
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Iniciando correção de totalUsed...\n');

  const balances = await prisma.internalBalance.findMany({
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  console.log(`📊 Total de saldos: ${balances.length}\n`);

  for (const balance of balances) {
    console.log(`${'='.repeat(80)}`);
    console.log(`👤 Usuário: ${balance.user.email}`);
    console.log(`💰 Cripto: ${balance.cryptoType} (${balance.network})`);
    console.log(`${'='.repeat(80)}\n`);

    // Buscar todas as transações DEDUCT
    const deductTransactions = await prisma.collateralTransaction.findMany({
      where: {
        balanceId: balance.id,
        type: 'DEDUCT',
      },
    });

    console.log(`📝 Transações DEDUCT encontradas: ${deductTransactions.length}`);

    // Calcular totalUsed correto (soma de DEDUCT)
    let calculatedTotalUsed = 0;
    for (const tx of deductTransactions) {
      const amount = parseFloat(tx.amount);
      calculatedTotalUsed += amount;
      console.log(`   💸 DEDUCT: ${amount.toFixed(8)} ${balance.cryptoType}`);
    }

    const currentTotalUsed = parseFloat(balance.totalUsed);

    console.log(`\n📊 COMPARAÇÃO:`);
    console.log(`   TotalUsed ATUAL: ${currentTotalUsed.toFixed(8)} ${balance.cryptoType}`);
    console.log(`   TotalUsed CALCULADO: ${calculatedTotalUsed.toFixed(8)} ${balance.cryptoType}`);
    console.log(`   Diferença: ${(currentTotalUsed - calculatedTotalUsed).toFixed(8)} ${balance.cryptoType}\n`);

    const tolerance = 0.00000001;
    const needsCorrection = Math.abs(currentTotalUsed - calculatedTotalUsed) > tolerance;

    if (needsCorrection) {
      console.log(`⚠️  CORREÇÃO NECESSÁRIA!\n`);

      await prisma.internalBalance.update({
        where: { id: balance.id },
        data: {
          totalUsed: calculatedTotalUsed.toFixed(8),
        },
      });

      console.log(`✅ totalUsed corrigido: ${currentTotalUsed.toFixed(8)} → ${calculatedTotalUsed.toFixed(8)}\n`);
    } else {
      console.log(`✅ totalUsed está CORRETO!\n`);
    }
  }

  console.log(`\n✅ Correção de totalUsed finalizada!\n`);
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
