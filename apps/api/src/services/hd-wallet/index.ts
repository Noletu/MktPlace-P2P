/**
 * HD Wallet System - Entry Point
 *
 * Sistema completo de carteiras HD (Hierarchical Deterministic) usando BIP32/BIP44.
 *
 * Componentes:
 * - MasterSeedService: Gerencia seed mestre BIP39
 * - DerivationService: Deriva carteiras para cada blockchain
 * - KeyManagementService: Criptografa/descriptografa private keys
 *
 * Segurança:
 * - Master seed criptografado com AES-256-GCM
 * - Private keys individuais criptografadas
 * - Nunca expõe keys em logs ou responses
 * - Derivação determinística (mesmo userId = mesmo endereço)
 */

export {MasterSeedService} from './master-seed.service';
export {DerivationService} from './derivation.service';
export {KeyManagementService} from './key-management.service';

/**
 * Valida que todo o sistema HD Wallet está configurado corretamente
 *
 * @returns true se tudo OK, lança erro caso contrário
 */
export function validateHDWalletSystem(): boolean {
  console.log('\n🔐 Validando HD Wallet System...\n');

  try {
    // 1. Validar Master Seed
    console.log('1️⃣  Validando Master Seed...');
    const {MasterSeedService} = require('./master-seed.service');
    MasterSeedService.validateSetup();
    console.log('   ✅ Master Seed OK\n');

    // 2. Validar Derivation
    console.log('2️⃣  Validando Derivation...');
    const {DerivationService} = require('./derivation.service');
    DerivationService.validateDerivation();
    console.log('   ✅ Derivation OK\n');

    // 3. Validar Key Encryption
    console.log('3️⃣  Validando Key Encryption...');
    const {KeyManagementService} = require('./key-management.service');
    KeyManagementService.validateEncryption();
    console.log('   ✅ Key Encryption OK\n');

    console.log('✅ HD Wallet System validado com sucesso!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Falha na validação do HD Wallet System:', (error as Error).message);
    console.error('\nVerifique se as seguintes variáveis estão configuradas em .env:');
    console.error('- MASTER_SEED_ENCRYPTION_KEY');
    console.error('- MASTER_SEED_ENCRYPTED');
    console.error('- WALLET_ENCRYPTION_KEY\n');
    throw error;
  }
}
