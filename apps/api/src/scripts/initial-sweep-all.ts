/**
 * Initial Sweep Script — Migração para Omnibus Architecture
 *
 * Varre TODOS os endereços de usuário com saldo on-chain > 0,
 * consolidando fundos no hot wallet (PlatformWallet Account 0).
 *
 * IMPORTANTE: Executar após a migração do schema (Fase 2) e deploy do SweepService (Fase 3).
 *
 * USO: npx tsx src/scripts/initial-sweep-all.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { SweepService } from '../services/sweep.service';
import { BlockchainService } from '../services/blockchain/blockchain.service';
import BigNumber from 'bignumber.js';
import { toBN } from '../utils/money';

const prisma = new PrismaClient();

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 10000; // 10s entre batches

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initialSweep() {
  console.log('=== Initial Sweep — Omnibus Migration ===\n');

  // 1. Buscar todos UserWallets com onChainSnapshot > 0
  const wallets = await prisma.userWallet.findMany({
    where: {
      isActive: true,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

  console.log(`Found ${wallets.length} user wallets total\n`);

  // Filtrar apenas os que têm saldo on-chain
  const walletsWithBalance: any[] = [];

  for (const wallet of wallets) {
    try {
      const onChainBalance = await BlockchainService.getBalance(
        wallet.address,
        wallet.network
      );
      const balance = toBN(onChainBalance).toNumber();
      const threshold = SweepService.MIN_SWEEP_THRESHOLD[wallet.cryptoType] || 0.001;

      if (balance >= threshold) {
        walletsWithBalance.push({
          ...wallet,
          currentOnChainBalance: balance,
        });
        console.log(
          `  ✅ ${wallet.cryptoType}/${wallet.network} (${wallet.user.email}): ${balance}`
        );
      }
    } catch (error: any) {
      console.error(
        `  ❌ Error checking ${wallet.cryptoType}/${wallet.network} (${wallet.address}): ${error.message}`
      );
    }
  }

  console.log(`\n${walletsWithBalance.length} wallets need sweeping\n`);

  if (walletsWithBalance.length === 0) {
    console.log('Nothing to sweep!');
    return;
  }

  // 2. Processar em batches
  let swept = 0;
  let failed = 0;

  for (let i = 0; i < walletsWithBalance.length; i += BATCH_SIZE) {
    const batch = walletsWithBalance.slice(i, i + BATCH_SIZE);
    console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(walletsWithBalance.length / BATCH_SIZE)} ---\n`);

    for (const wallet of batch) {
      try {
        console.log(`Sweeping ${wallet.cryptoType}/${wallet.network} (${wallet.user.email})...`);

        // Marcar como PENDING para o SweepService processar
        await prisma.userWallet.update({
          where: { id: wallet.id },
          data: {
            sweepStatus: 'PENDING',
            pendingSweepAmount: wallet.currentOnChainBalance.toString(),
            onChainSnapshot: wallet.currentOnChainBalance.toString(),
          },
        });

        // Executar sweep
        await SweepService.sweepWallet(wallet.id);
        swept++;
        console.log(`  ✅ Sweep initiated successfully`);
      } catch (error: any) {
        console.error(`  ❌ Sweep failed: ${error.message}`);
        failed++;
      }
    }

    // Aguardar entre batches
    if (i + BATCH_SIZE < walletsWithBalance.length) {
      console.log(`\nAguardando ${DELAY_BETWEEN_BATCHES_MS / 1000}s antes do próximo batch...`);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // 3. Verificação de solvência
  console.log('\n\n=== Solvency Check ===\n');

  const platformWallets = await prisma.platformWallet.findMany({
    where: { isActive: true },
  });

  for (const hotWallet of platformWallets) {
    const userWallets = await prisma.userWallet.findMany({
      where: {
        cryptoType: hotWallet.cryptoType,
        network: hotWallet.network,
        isActive: true,
      },
      select: { balance: true },
    });

    const totalUserBalance = userWallets.reduce(
      (sum, w) => sum.plus(toBN(w.balance)),
      toBN("0")
    );

    const hotBalance = toBN(hotWallet.balance);
    const delta = hotBalance.minus(totalUserBalance);

    const status = delta.gte(0) ? '✅ SOLVENT' : '🚨 INSOLVENT';

    console.log(
      `${status} ${hotWallet.cryptoType}/${hotWallet.network}:`,
      `hot=${hotBalance.toString()}, users=${totalUserBalance.toString()}, delta=${delta.toString()}`
    );
  }

  // 4. Summary
  console.log('\n=== Summary ===');
  console.log(`Swept:  ${swept}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${walletsWithBalance.length}`);

  if (failed > 0) {
    console.error('\nWARNING: Some wallets failed to sweep! Run again or check logs.');
  }
}

initialSweep()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
