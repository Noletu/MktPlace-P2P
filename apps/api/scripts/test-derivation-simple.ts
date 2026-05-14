import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { DerivationService } from '../src/services/hd-wallet/derivation.service';
import { KeyManagementService } from '../src/services/hd-wallet/key-management.service';
import { MasterSeedService } from '../src/services/hd-wallet/master-seed.service';

console.log('🧪 Teste Simples de Derivação e Criptografia\n');

// Inicializar serviços
console.log('⚙️  Inicializando serviços...');
try {
  MasterSeedService.initialize();
  KeyManagementService.initialize();
  console.log('✅ Serviços inicializados com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao inicializar serviços:', (error as Error).message);
  process.exit(1);
}

const testUserId = 'test-user-simple';

// 1. Derivar carteira
console.log('1️⃣ Derivando carteira Bitcoin...');
const wallet = DerivationService.deriveWallet(testUserId, 'BTC', 'BITCOIN');

console.log('   Endereço:', wallet.address);
console.log('   Path:', wallet.derivationPath);
console.log('   PrivateKey Type:', typeof wallet.privateKey);
console.log('   PrivateKey Length:', wallet.privateKey.length);
console.log('   PrivateKey (primeiros 20 chars):', wallet.privateKey.substring(0, 20));
console.log('   PrivateKey (HEX válido?):', /^[0-9a-f]+$/i.test(wallet.privateKey));

// 2. Testar criptografia
console.log('\n2️⃣ Testando criptografia...');
console.log('   Original:', wallet.privateKey.substring(0, 20) + '...');

const encrypted = KeyManagementService.encryptPrivateKey(wallet.privateKey, testUserId);
console.log('   Encriptado:', encrypted.substring(0, 40) + '...');

const decrypted = KeyManagementService.decryptPrivateKey(encrypted, testUserId);
console.log('   Decriptado:', decrypted.substring(0, 20) + '...');

// 3. Verificar integridade
console.log('\n3️⃣ Verificando integridade...');
console.log('   Original === Decrypted?', wallet.privateKey === decrypted);

if (wallet.privateKey === decrypted) {
  console.log('   ✅ SUCESSO: Criptografia funcionando corretamente!');
} else {
  console.log('   ❌ FALHA: Private keys diferentes!');
  console.log('   Original length:', wallet.privateKey.length);
  console.log('   Decrypted length:', decrypted.length);
  console.log('   Original (full):', wallet.privateKey);
  console.log('   Decrypted (full):', decrypted);
}

process.exit(wallet.privateKey === decrypted ? 0 : 1);
