/**
 * Script v2 para Corrigir Saldos Bloqueados - ESTRATÉGIA ROBUSTA
 *
 * DIFERENÇAS DA v1:
 * - Recalcula lockedAmount do ZERO baseado apenas em pedidos ativos
 * - Idempotente (pode executar múltiplas vezes sem problemas)
 * - Validação cruzada entre saldo e pedidos
 * - Modo dry-run para simular
 * - Logs detalhados de cada operação
 *
 * LÓGICA:
 * 1. Para cada usuário com saldo interno:
 *    a. Buscar TODOS os pedidos (ativos E finalizados)
 *    b. Calcular lockedAmount ESPERADO (soma apenas pedidos ativos)
 *    c. Comparar com lockedAmount ATUAL
 *    d. Se diferente: CORRIGIR
 * 2. Processar pedidos órfãos (COMPLETED/CANCELLED com saldo bloqueado)
 * 3. Atualizar lockedAmount para valor CORRETO (recalculado)
 *
 * COMO USAR:
 * cd apps/api
 *
 * # Modo diagnóstico (não faz mudanças)
 * npx tsx scripts/fix-locked-balances-v2.ts --dry-run
 *
 * # Modo correção (padrão)
 * npx tsx scripts/fix-locked-balances-v2.ts
 *
 * # Corrigir usuário específico
 * npx tsx scripts/fix-locked-balances-v2.ts --user=USER_ID
 *
 * # Verbose (logs detalhados)
 * npx tsx scripts/fix-locked-balances-v2.ts --verbose
 *
 * VERSÃO: 3.0.7
 * DATA: 25/10/2025
 */

import { PrismaClient } from '@prisma/client';
import { internalBalanceService } from '../src/services/internal-balance.service';

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY_RUN;
const USER_ID = args.find(arg => arg.startsWith('--user='))?.split('=')[1];

// Estados de pedidos que DEVEM ter saldo bloqueado
const ACTIVE_ORDER_STATUSES = ['PENDING', 'IN_NEGOTIATION', 'MATCHED', 'PAYMENT_SENT', 'VALIDATING'];

// Estados de pedidos que NÃO DEVEM ter saldo bloqueado
const FINALIZED_ORDER_STATUSES = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'];

interface UserBalance {
  userId: string;
  cryptoType: string;
  network: string;
  currentBalance: string;
  currentLocked: string;
  currentAvailable: string;
  expectedLocked: string;
  needsCorrection: boolean;
}

interface OrderSummary {
  id: string;
  status: string;
  amount: string;
  collateralLocked: boolean;
  shouldBeLocked: boolean;
}

async function main() {
  console.log('🔍 Iniciando correção robusta de saldos bloqueados v2...\n');

  if (DRY_RUN) {
    console.log('⚠️  MODO DRY-RUN: Nenhuma mudança será feita no banco de dados\n');
  }

  if (USER_ID) {
    console.log(`👤 Corrigindo apenas usuário: ${USER_ID}\n`);
  }

  // 1. Buscar todos usuários com saldo interno
  const balances = await prisma.internalBalance.findMany({
    where: USER_ID ? { userId: USER_ID } : {},
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  console.log(`📊 Total de saldos para analisar: ${balances.length}\n`);

  const problems: UserBalance[] = [];
  let totalCorrected = 0;
  let totalErrors = 0;

  // 2. Analisar cada saldo
  for (const balance of balances) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`👤 Usuário: ${balance.user.email} (${balance.userId})`);
    console.log(`💰 Cripto: ${balance.cryptoType} (${balance.network})`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      // Buscar TODOS os pedidos do usuário com saldo interno
      const orders = await prisma.order.findMany({
        where: {
          userId: balance.userId,
          cryptoType: balance.cryptoType,
          cryptoNetwork: balance.network,
          collateralSource: 'INTERNAL_BALANCE',
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      console.log(`📦 Total de pedidos encontrados: ${orders.length}`);

      // Separar pedidos por status
      const activeOrders = orders.filter(o => ACTIVE_ORDER_STATUSES.includes(o.status));
      const finalizedOrders = orders.filter(o => FINALIZED_ORDER_STATUSES.includes(o.status));
      const orphanOrders = finalizedOrders.filter(o => o.collateralLocked === true);

      console.log(`   ✅ Pedidos ativos: ${activeOrders.length}`);
      console.log(`   🏁 Pedidos finalizados: ${finalizedOrders.length}`);
      console.log(`   🐛 Pedidos órfãos (finalizados mas bloqueados): ${orphanOrders.length}\n`);

      // Calcular lockedAmount ESPERADO (soma apenas pedidos ativos)
      let expectedLocked = 0;
      for (const order of activeOrders) {
        const amount = parseFloat(order.collateralLockedAmount || '0');
        expectedLocked += amount;

        if (VERBOSE) {
          console.log(`   📌 Pedido ativo ${order.id.substring(0, 8)}... (${order.status}): ${amount} ${balance.cryptoType}`);
        }
      }

      const currentLocked = parseFloat(balance.lockedAmount);
      const needsCorrection = Math.abs(currentLocked - expectedLocked) > 0.00000001; // Tolerância para arredondamento

      console.log(`\n📊 ESTADO ATUAL:`);
      console.log(`   Saldo Total: ${balance.balance} ${balance.cryptoType}`);
      console.log(`   Bloqueado ATUAL: ${balance.lockedAmount} ${balance.cryptoType}`);
      console.log(`   Bloqueado ESPERADO: ${expectedLocked.toFixed(8)} ${balance.cryptoType}`);
      console.log(`   Diferença: ${(currentLocked - expectedLocked).toFixed(8)} ${balance.cryptoType}`);

      if (needsCorrection) {
        console.log(`\n⚠️  INCONSISTÊNCIA DETECTADA! Correção necessária.\n`);

        problems.push({
          userId: balance.userId,
          cryptoType: balance.cryptoType,
          network: balance.network,
          currentBalance: balance.balance,
          currentLocked: balance.lockedAmount,
          currentAvailable: balance.availableAmount,
          expectedLocked: expectedLocked.toFixed(8),
          needsCorrection: true,
        });

        if (!DRY_RUN) {
          // CORREÇÃO 1: Processar pedidos órfãos
          for (const orphan of orphanOrders) {
            console.log(`\n🔧 Processando pedido órfão: ${orphan.id}`);
            console.log(`   Status: ${orphan.status}`);
            console.log(`   Valor: ${orphan.collateralLockedAmount} ${balance.cryptoType}`);

            if (orphan.status === 'COMPLETED') {
              // COMPLETED: Desbloquear + Debitar
              try {
                // 1. Desbloquear
                await internalBalanceService.unlockBalance(
                  orphan.userId,
                  orphan.cryptoType,
                  orphan.cryptoNetwork,
                  orphan.collateralLockedAmount!,
                  orphan.id
                );
                console.log(`   ✅ Desbloqueado: ${orphan.collateralLockedAmount} ${balance.cryptoType}`);

                // 2. Debitar
                await internalBalanceService.deductBalance(
                  orphan.userId,
                  orphan.cryptoType,
                  orphan.cryptoNetwork,
                  orphan.collateralLockedAmount!
                );
                console.log(`   ✅ Debitado: ${orphan.collateralLockedAmount} ${balance.cryptoType}`);

                // 3. Marcar pedido como processado
                await prisma.order.update({
                  where: { id: orphan.id },
                  data: { collateralLocked: false },
                });
              } catch (error: any) {
                console.error(`   ❌ Erro ao processar COMPLETED:`, error.message);
                totalErrors++;
              }

            } else if (orphan.status === 'CANCELLED') {
              // CANCELLED: Apenas desbloquear
              try {
                await internalBalanceService.unlockBalance(
                  orphan.userId,
                  orphan.cryptoType,
                  orphan.cryptoNetwork,
                  orphan.collateralLockedAmount!,
                  orphan.id
                );
                console.log(`   ✅ Desbloqueado: ${orphan.collateralLockedAmount} ${balance.cryptoType}`);

                await prisma.order.update({
                  where: { id: orphan.id },
                  data: { collateralLocked: false },
                });
              } catch (error: any) {
                console.error(`   ❌ Erro ao processar CANCELLED:`, error.message);
                totalErrors++;
              }
            }
          }

          // CORREÇÃO 2: Recalcular e forçar lockedAmount correto
          console.log(`\n🔄 Recalculando lockedAmount do ZERO...`);

          const newTotal = parseFloat(balance.balance);
          const newLocked = expectedLocked;
          const newAvailable = newTotal - newLocked;

          await prisma.internalBalance.update({
            where: { id: balance.id },
            data: {
              lockedAmount: newLocked.toFixed(8),
              availableAmount: newAvailable.toFixed(8),
            },
          });

          console.log(`✅ Saldo corrigido:`);
          console.log(`   Total: ${newTotal.toFixed(8)} ${balance.cryptoType}`);
          console.log(`   Bloqueado: ${newLocked.toFixed(8)} ${balance.cryptoType}`);
          console.log(`   Disponível: ${newAvailable.toFixed(8)} ${balance.cryptoType}`);

          totalCorrected++;
        } else {
          console.log(`\n🔍 [DRY-RUN] Ações que seriam executadas:`);
          console.log(`   - Processar ${orphanOrders.length} pedidos órfãos`);
          console.log(`   - Atualizar lockedAmount: ${balance.lockedAmount} → ${expectedLocked.toFixed(8)}`);
        }
      } else {
        console.log(`\n✅ Saldo está CORRETO! Nenhuma correção necessária.\n`);
      }

    } catch (error: any) {
      console.error(`\n❌ Erro ao processar usuário ${balance.userId}:`, error.message);
      totalErrors++;
    }
  }

  // 3. Resumo final
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`📊 RESUMO FINAL`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`Total de saldos analisados: ${balances.length}`);
  console.log(`Problemas detectados: ${problems.length}`);

  if (!DRY_RUN) {
    console.log(`Correções aplicadas: ${totalCorrected}`);
    console.log(`Erros encontrados: ${totalErrors}`);
  } else {
    console.log(`\n⚠️  MODO DRY-RUN: Nenhuma mudança foi feita`);
    console.log(`Execute sem --dry-run para aplicar as correções\n`);
  }

  if (problems.length > 0) {
    console.log(`\n📋 Detalhes dos problemas encontrados:\n`);
    for (const problem of problems) {
      console.log(`👤 ${problem.userId}`);
      console.log(`   ${problem.cryptoType}/${problem.network}`);
      console.log(`   Bloqueado atual: ${problem.currentLocked}`);
      console.log(`   Bloqueado esperado: ${problem.expectedLocked}`);
      console.log(`   Diferença: ${(parseFloat(problem.currentLocked) - parseFloat(problem.expectedLocked)).toFixed(8)}\n`);
    }
  }

  console.log(`\n✅ Script finalizado!\n`);
}

// Executar script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal ao executar script:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
