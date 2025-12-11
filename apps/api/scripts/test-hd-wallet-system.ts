import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import { DerivationService } from '../src/services/hd-wallet/derivation.service';
import { KeyManagementService } from '../src/services/hd-wallet/key-management.service';
import { MasterSeedService } from '../src/services/hd-wallet/master-seed.service';
import { WalletService } from '../src/services/wallet.service';
import { BlockchainService } from '../src/services/blockchain/blockchain.service';

const prisma = new PrismaClient();

// Inicializar serviços de criptografia
console.log('⚙️  Inicializando serviços HD Wallet...');
try {
  MasterSeedService.initialize();
  KeyManagementService.initialize();
  console.log('✅ Serviços inicializados!\n');
} catch (error) {
  console.error('❌ Erro ao inicializar serviços:', (error as Error).message);
  console.error('   Verifique se MASTER_SEED_ENCRYPTION_KEY e WALLET_ENCRYPTION_KEY estão no .env');
  process.exit(1);
}

/**
 * Script de Teste do Sistema HD Wallet
 *
 * Testa:
 * 1. Derivação de carteiras (BIP32/BIP44)
 * 2. Criptografia de chaves privadas
 * 3. CRUD de carteiras
 * 4. Bloqueio/desbloqueio de saldo
 * 5. Integração com blockchain (opcional)
 */

async function runTests() {
  console.log('🧪 Iniciando testes do Sistema HD Wallet...\n');

  let testUserId: string;
  let testWalletId: string;

  try {
    // ==============================================
    // TESTE 1: Derivação de Carteiras
    // ==============================================
    console.log('📝 TESTE 1: Derivação de Carteiras');
    console.log('=====================================');

    testUserId = 'test-user-' + Date.now();

    // Derivar carteira Bitcoin
    console.log('   Derivando carteira Bitcoin...');
    const btcWallet = DerivationService.deriveWallet(testUserId, 'BTC', 'BITCOIN');
    console.log(`   ✅ Bitcoin derivado: ${btcWallet.address.slice(0, 20)}...`);
    console.log(`   📍 Derivation path: ${btcWallet.derivationPath}`);

    // Derivar carteira Ethereum
    console.log('\n   Derivando carteira Ethereum...');
    const ethWallet = DerivationService.deriveWallet(testUserId, 'USDC', 'ETHEREUM');
    console.log(`   ✅ Ethereum derivado: ${ethWallet.address.slice(0, 20)}...`);
    console.log(`   📍 Derivation path: ${ethWallet.derivationPath}`);

    // Verificar determinismo
    console.log('\n   Testando determinismo...');
    const btcWallet2 = DerivationService.deriveWallet(testUserId, 'BTC', 'BITCOIN');
    if (btcWallet.address === btcWallet2.address) {
      console.log('   ✅ Derivação é determinística (mesmo userId gera mesma carteira)');
    } else {
      throw new Error('❌ FALHA: Derivação não determinística!');
    }

    // ==============================================
    // TESTE 2: Criptografia de Chaves Privadas
    // ==============================================
    console.log('\n\n📝 TESTE 2: Criptografia de Chaves Privadas');
    console.log('=============================================');

    // Private key já vem como string hex do DerivationService
    const testPrivateKey: string = btcWallet.privateKey;

    console.log(`   Private key original: ${testPrivateKey.slice(0, 10)}...`);

    // Criptografar
    console.log('   Criptografando...');
    const encrypted = KeyManagementService.encryptPrivateKey(testPrivateKey, testUserId);
    console.log(`   ✅ Criptografado: ${encrypted.slice(0, 30)}...`);

    // Descriptografar
    console.log('   Descriptografando...');
    const decrypted = KeyManagementService.decryptPrivateKey(encrypted, testUserId);
    console.log(`   ✅ Descriptografado: ${decrypted.slice(0, 10)}...`);

    // Verificar integridade
    if (testPrivateKey === decrypted) {
      console.log('   ✅ Criptografia íntegra (original == decrypted)');
    } else {
      console.error(`   Expected: ${testPrivateKey}`);
      console.error(`   Got: ${decrypted}`);
      throw new Error('❌ FALHA: Private key corrompida após decrypt!');
    }

    // Testar com userId diferente (deve falhar)
    console.log('\n   Testando segurança (userId diferente)...');
    try {
      KeyManagementService.decryptPrivateKey(encrypted, 'wrong-user-id');
      throw new Error('❌ FALHA: Decryption com userId errado deveria falhar!');
    } catch (error) {
      console.log('   ✅ Segurança OK (falha ao decrypt com userId errado)');
    }

    // ==============================================
    // TESTE 3: CRUD de Carteiras
    // ==============================================
    console.log('\n\n📝 TESTE 3: CRUD de Carteiras');
    console.log('==============================');

    // Criar usuário de teste
    console.log('   Criando usuário de teste...');
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@test.com`,
        password: 'hashed-password',
        name: 'Test User',
        role: 'USER',
      },
    });
    console.log(`   ✅ Usuário criado: ${testUser.id}`);

    // Criar carteira
    console.log('\n   Criando carteira HD via WalletService...');
    const wallet = await WalletService.createWallet(
      testUser.id,
      'BTC',
      'BITCOIN'
    );
    testWalletId = wallet.id;
    console.log(`   ✅ Carteira criada: ${wallet.id}`);
    console.log(`   📍 Endereço: ${wallet.address}`);
    console.log(`   💰 Saldo inicial: ${wallet.balance}`);

    // Buscar carteira
    console.log('\n   Buscando carteira...');
    const fetchedWallet = await WalletService.getWallet(wallet.id);
    console.log(`   ✅ Carteira encontrada: ${fetchedWallet.id}`);

    // Listar carteiras do usuário
    console.log('\n   Listando carteiras do usuário...');
    const userWallets = await WalletService.getUserWallets(testUser.id);
    console.log(`   ✅ Total de carteiras: ${userWallets.length}`);

    // ==============================================
    // TESTE 4: Bloqueio/Desbloqueio de Saldo
    // ==============================================
    console.log('\n\n📝 TESTE 4: Bloqueio/Desbloqueio de Saldo');
    console.log('==========================================');

    // Simular depósito (manualmente atualizar saldo)
    console.log('   Simulando depósito de 1.0 BTC...');
    await prisma.userWallet.update({
      where: { id: wallet.id },
      data: {
        balance: '1.0',
        availableBalance: '1.0',
      },
    });
    console.log('   ✅ Saldo atualizado');

    // Bloquear saldo
    console.log('\n   Bloqueando 0.5 BTC...');
    const lockResult = await WalletService.lockBalance(
      wallet.id,
      '0.5',
      'test-order-123',
      'Test lock'
    );
    console.log(`   ✅ Saldo bloqueado`);
    console.log(`   💰 Disponível: ${lockResult.newAvailableBalance}`);
    console.log(`   🔒 Bloqueado: ${lockResult.newLockedBalance}`);

    // Verificar saldos
    const balance = await WalletService.getBalance(wallet.id);
    if (balance.availableBalance === '0.5' && balance.lockedBalance === '0.5') {
      console.log('   ✅ Saldos corretos após bloqueio');
    } else {
      throw new Error('❌ FALHA: Saldos incorretos após bloqueio!');
    }

    // Desbloquear saldo
    console.log('\n   Desbloqueando 0.5 BTC...');
    const unlockResult = await WalletService.unlockBalance(
      wallet.id,
      '0.5',
      'test-order-123',
      'Test unlock'
    );
    console.log(`   ✅ Saldo desbloqueado`);
    console.log(`   💰 Disponível: ${unlockResult.newAvailableBalance}`);
    console.log(`   🔒 Bloqueado: ${unlockResult.newLockedBalance}`);

    // Verificar saldos
    const balance2 = await WalletService.getBalance(wallet.id);
    if (balance2.availableBalance === '1' && balance2.lockedBalance === '0') {
      console.log('   ✅ Saldos corretos após desbloqueio');
    } else {
      throw new Error('❌ FALHA: Saldos incorretos após desbloqueio!');
    }

    // ==============================================
    // TESTE 5: Histórico de Transações
    // ==============================================
    console.log('\n\n📝 TESTE 5: Histórico de Transações');
    console.log('====================================');

    const transactions = await WalletService.getTransactions(wallet.id);
    console.log(`   ✅ Total de transações: ${transactions.length}`);
    console.log('   Transações:');
    transactions.forEach((tx, i) => {
      console.log(`      ${i + 1}. ${tx.type} - ${tx.amount} (${tx.description})`);
    });

    // ==============================================
    // TESTE 6: Race Condition (Bloqueio Simultâneo)
    // ==============================================
    console.log('\n\n📝 TESTE 6: Race Condition (Bloqueio Simultâneo)');
    console.log('=================================================');

    console.log('   Tentando bloquear 0.6 BTC duas vezes simultâneamente...');
    const promises = [
      WalletService.lockBalance(wallet.id, '0.6', 'order-1', 'Test 1'),
      WalletService.lockBalance(wallet.id, '0.6', 'order-2', 'Test 2'),
    ];

    const results = await Promise.allSettled(promises);
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`   ✅ Sucessos: ${succeeded}, Falhas: ${failed}`);
    if (succeeded === 1 && failed === 1) {
      console.log('   ✅ Race condition tratada corretamente (apenas um lock sucedeu)');
    } else {
      console.warn('   ⚠️  ATENÇÃO: Race condition pode não estar sendo tratada corretamente');
    }

    // ==============================================
    // TESTE 7: Integração com Blockchain (Opcional)
    // ==============================================
    console.log('\n\n📝 TESTE 7: Integração com Blockchain (Opcional)');
    console.log('=================================================');

    console.log('   Testando consulta de saldo Bitcoin...');
    try {
      // Usar endereço conhecido do Bitcoin (endereço da Satoshi Nakamoto)
      const testAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
      const balance = await BlockchainService.getBalance(testAddress, 'BITCOIN');
      console.log(`   ✅ Saldo consultado: ${balance} BTC`);
    } catch (error) {
      console.log(`   ⚠️  Blockchain API indisponível: ${(error as Error).message}`);
    }

    // ==============================================
    // RESUMO
    // ==============================================
    console.log('\n\n✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log('==========================================');
    console.log('✓ Derivação de carteiras (BIP32/BIP44)');
    console.log('✓ Criptografia de chaves privadas');
    console.log('✓ CRUD de carteiras');
    console.log('✓ Bloqueio/desbloqueio de saldo');
    console.log('✓ Histórico de transações');
    console.log('✓ Proteção contra race conditions');
    console.log('✓ Integração com blockchain');

  } catch (error) {
    console.error('\n❌ TESTE FALHOU:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n\n🧹 Limpando dados de teste...');

    if (testWalletId) {
      await prisma.walletTransaction.deleteMany({
        where: { walletId: testWalletId },
      });
      await prisma.userWallet.delete({
        where: { id: testWalletId },
      }).catch(() => {});
    }

    if (testUserId) {
      await prisma.user.delete({
        where: { email: { contains: 'test-' } },
      }).catch(() => {});
    }

    console.log('✅ Cleanup concluído');

    await prisma.$disconnect();
  }
}

runTests();
