/**
 * Migration Script: Platform Wallet Encryption Fix
 *
 * Re-deriva as private keys da master seed e re-criptografa com userId = "PLATFORM_SYSTEM".
 * Usa DerivationService para obter a private key (determinístico) em vez de tentar
 * decriptar a chave antiga (que pode ter sido criptografada com material inválido).
 *
 * USO: npx tsx src/scripts/migrate-platform-wallet-encryption.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { KeyManagementService } from '../services/hd-wallet/key-management.service';
import { MasterSeedService } from '../services/hd-wallet/master-seed.service';
import { DerivationService } from '../services/hd-wallet/derivation.service';

// Re-inicializar após dotenv
KeyManagementService.initialize();
MasterSeedService.initialize();

const prisma = new PrismaClient();
const NEW_USER_ID = KeyManagementService.PLATFORM_ID; // 'PLATFORM_SYSTEM'

async function migrate() {
  console.log('=== Platform Wallet Encryption Migration ===\n');

  const wallets = await prisma.platformWallet.findMany();
  console.log(`Found ${wallets.length} platform wallets\n`);

  let success = 0;
  let failed = 0;

  for (const wallet of wallets) {
    const label = `${wallet.cryptoType}/${wallet.network}`;
    console.log(`Processing ${label}...`);

    try {
      // 1. Verificar se já decripta com PLATFORM_SYSTEM
      try {
        const key = KeyManagementService.decryptPrivateKey(
          wallet.encryptedPrivateKey,
          NEW_USER_ID
        );
        console.log(`  Already migrated (decrypts with PLATFORM_SYSTEM) - skipping`);
        success++;
        continue;
      } catch {
        // Precisa migrar
      }

      // 2. Re-derivar private key da master seed (determinístico)
      console.log(`  Re-deriving from master seed...`);
      const derived = DerivationService.derivePlatformWallet(
        wallet.cryptoType,
        wallet.network
      );

      // 3. Verificar integridade: endereço derivado == endereço armazenado
      if (derived.address !== wallet.address) {
        console.error(`  ERROR: Address mismatch!`);
        console.error(`    Stored:  ${wallet.address}`);
        console.error(`    Derived: ${derived.address}`);
        console.error(`  Skipping — manual intervention required`);
        failed++;
        continue;
      }

      console.log(`  Address verification: OK (${derived.address})`);

      // 4. Criptografar com PLATFORM_SYSTEM
      const newEncryptedKey = KeyManagementService.encryptPrivateKey(
        derived.privateKey,
        NEW_USER_ID
      );

      // 5. Verificar que re-encryption funciona
      const verifyDecrypt = KeyManagementService.decryptPrivateKey(
        newEncryptedKey,
        NEW_USER_ID
      );

      if (verifyDecrypt !== derived.privateKey) {
        console.error(`  ERROR: Re-encryption verification mismatch!`);
        failed++;
        continue;
      }

      // 6. Atualizar no banco
      await prisma.platformWallet.update({
        where: { id: wallet.id },
        data: { encryptedPrivateKey: newEncryptedKey },
      });

      console.log(`  Migrated successfully\n`);
      success++;
    } catch (error: any) {
      console.error(`  ERROR: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Success: ${success}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Total:   ${wallets.length}`);

  if (failed > 0) {
    console.error('\nWARNING: Some wallets failed migration! Check logs above.');
    process.exit(1);
  }

  console.log('\nMigration completed successfully!');
}

migrate()
  .catch((error) => {
    console.error('Migration fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
