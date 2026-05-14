/**
 * Setup HD Wallet System
 *
 * Script para configuração inicial do sistema de carteiras HD.
 *
 * EXECUTE APENAS UMA VEZ no setup inicial!
 *
 * Este script irá:
 * 1. Gerar chaves de criptografia (MASTER_SEED_ENCRYPTION_KEY, WALLET_ENCRYPTION_KEY)
 * 2. Gerar master seed BIP39 (24 palavras)
 * 3. Criptografar o master seed
 * 4. Exibir instruções para adicionar ao .env
 *
 * ATENÇÃO:
 * - Guarde o mnemonic (24 palavras) em local SEGURO (cold storage)!
 * - SEM o mnemonic, você PERDE acesso a TODAS as carteiras!
 * - As chaves de criptografia devem ser mantidas em segredo
 */

import * as crypto from 'crypto';
import * as bip39 from 'bip39';
import * as fs from 'fs';
import * as path from 'path';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(color + message + colors.reset);
}

function setupHDWallet() {
  console.log('\n');
  log('═══════════════════════════════════════════════════════════════', colors.cyan);
  log('  🔐 HD WALLET SYSTEM - SETUP INICIAL', colors.cyan + colors.bright);
  log('═══════════════════════════════════════════════════════════════', colors.cyan);
  console.log('\n');

  log('⚠️  ATENÇÃO: Execute este script APENAS UMA VEZ!', colors.yellow + colors.bright);
  log('⚠️  Guarde o mnemonic em local SEGURO (cold storage)!', colors.yellow + colors.bright);
  console.log('\n');

  // 1. Gerar Master Seed Encryption Key
  log('1️⃣  Gerando MASTER_SEED_ENCRYPTION_KEY...', colors.blue);
  const masterSeedEncryptionKey = crypto.randomBytes(32).toString('hex');
  log('   ✅ Gerada: ' + masterSeedEncryptionKey.slice(0, 16) + '...', colors.green);
  console.log('');

  // 2. Gerar Wallet Encryption Key
  log('2️⃣  Gerando WALLET_ENCRYPTION_KEY...', colors.blue);
  const walletEncryptionKey = crypto.randomBytes(32).toString('hex');
  log('   ✅ Gerada: ' + walletEncryptionKey.slice(0, 16) + '...', colors.green);
  console.log('');

  // 3. Gerar Master Seed BIP39 (24 palavras)
  log('3️⃣  Gerando Master Seed BIP39 (24 palavras)...', colors.blue);
  const entropy = crypto.randomBytes(32);
  const mnemonic = bip39.entropyToMnemonic(entropy);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  log('   ✅ Mnemonic gerado (24 palavras)', colors.green);
  console.log('');

  // 4. Criptografar Master Seed
  log('4️⃣  Criptografando Master Seed...', colors.blue);
  const encryptedSeed = encryptSeed(seed, masterSeedEncryptionKey);
  log('   ✅ Seed criptografado', colors.green);
  console.log('');

  // 5. Exibir instruções
  console.log('\n');
  log('═══════════════════════════════════════════════════════════════', colors.cyan);
  log('  ✅ SETUP CONCLUÍDO COM SUCESSO!', colors.green + colors.bright);
  log('═══════════════════════════════════════════════════════════════', colors.cyan);
  console.log('\n');

  log('📋 PRÓXIMOS PASSOS:', colors.cyan + colors.bright);
  console.log('');

  log('1. Adicione as seguintes linhas ao seu arquivo .env:', colors.yellow);
  console.log('');
  console.log('   # HD Wallet System - Chaves de Criptografia');
  console.log(`   MASTER_SEED_ENCRYPTION_KEY=${masterSeedEncryptionKey}`);
  console.log(`   WALLET_ENCRYPTION_KEY=${walletEncryptionKey}`);
  console.log('');
  console.log('   # HD Wallet System - Master Seed Criptografado');
  console.log(`   MASTER_SEED_ENCRYPTED=${encryptedSeed}`);
  console.log('');

  log('2. Guarde o mnemonic (24 palavras) em local SEGURO:', colors.yellow + colors.bright);
  console.log('');
  log('   ⚠️  SEM O MNEMONIC, VOCÊ PERDE ACESSO A TODAS AS CARTEIRAS!', colors.red + colors.bright);
  console.log('');
  console.log('   Mnemonic (24 palavras):');
  console.log('   ┌─────────────────────────────────────────────────────────────┐');
  mnemonic.split(' ').forEach((word, i) => {
    const number = String(i + 1).padStart(2, ' ');
    const formattedWord = word.padEnd(12, ' ');
    if (i % 4 === 0) process.stdout.write('   │ ');
    process.stdout.write(`${number}. ${formattedWord}`);
    if (i % 4 === 3) {
      console.log(' │');
    }
  });
  console.log('   └─────────────────────────────────────────────────────────────┘');
  console.log('');

  log('3. Salve também em formato JSON (opcional):', colors.yellow);
  console.log('');
  const backupData = {
    generatedAt: new Date().toISOString(),
    mnemonic: mnemonic.split(' '),
    masterSeedEncryptionKey,
    walletEncryptionKey,
    encryptedSeed,
    warning: 'MANTENHA ESTE ARQUIVO EM LOCAL SEGURO! Nunca compartilhe estas informações!',
  };

  const backupPath = path.join(__dirname, '..', 'hd-wallet-backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  log(`   ✅ Backup salvo em: ${backupPath}`, colors.green);
  console.log('');

  log('4. OPCIONAL - Validar setup:', colors.yellow);
  console.log('');
  console.log('   npm run hd-wallet:validate');
  console.log('');

  console.log('\n');
  log('═══════════════════════════════════════════════════════════════', colors.cyan);
  log('  ✨ Sistema HD Wallet pronto para uso!', colors.green + colors.bright);
  log('═══════════════════════════════════════════════════════════════', colors.cyan);
  console.log('\n');
}

/**
 * Criptografa o seed com AES-256-GCM (mesmo algoritmo do MasterSeedService)
 */
function encryptSeed(seed: Buffer, encryptionKey: string): string {
  const IV_LENGTH = 12;

  // Gerar IV aleatório
  const iv = crypto.randomBytes(IV_LENGTH);

  // Converter encryption key de hex para buffer
  const key = Buffer.from(encryptionKey, 'hex');

  // Criar cipher AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Criptografar
  const ciphertext = Buffer.concat([
    cipher.update(seed),
    cipher.final(),
  ]);

  // Obter authentication tag
  const authTag = cipher.getAuthTag();

  // Retornar: iv:authTag:ciphertext (hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

// Executar setup
try {
  setupHDWallet();
} catch (error) {
  console.error('\n❌ Erro durante setup:', (error as Error).message);
  console.error((error as Error).stack);
  process.exit(1);
}
