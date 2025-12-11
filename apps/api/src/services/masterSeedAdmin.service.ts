import { PrismaClient } from '@prisma/client';
import { MasterSeedService } from './hd-wallet/master-seed.service';
import { DerivationService } from './hd-wallet/derivation.service';
import * as bip39 from 'bip39';

const prisma = new PrismaClient();

export class MasterSeedAdminService {
  /**
   * Retorna status atual sem expor dados sensíveis
   */
  async getStatus() {
    const isInitialized = this.isInitialized();

    if (!isInitialized) {
      return {
        initialized: false,
        message: 'Master seed não configurada',
      };
    }

    // Conta carteiras derivadas
    const walletsCount = await prisma.userWallet.count();
    const usersWithWallets = await prisma.userWallet.groupBy({
      by: ['userId'],
    });

    // NOVO: Buscar platform wallets (carteiras dos sócios)
    const { platformWalletService } = await import('./platformWallet.service');
    const platformWallets = await platformWalletService.getAllPlatformWallets();

    // Busca timestamp de criação da seed
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'MASTER_SEED_CREATED',
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      initialized: true,
      createdAt: auditLog?.createdAt,
      encryption: 'AES-256-GCM',
      supportedNetworks: ['BITCOIN', 'ETHEREUM', 'BASE', 'ARBITRUM', 'SOLANA'],
      stats: {
        usersWithWallets: usersWithWallets.length,
        totalUserWallets: walletsCount,
        platformWalletsCount: platformWallets.length,
      },
      platformWallets: platformWallets.map((w) => ({
        cryptoType: w.cryptoType,
        network: w.network,
        address: w.address,
        balance: w.balance,
        totalFeesCollected: w.totalFeesCollected,
      })),
    };
  }

  /**
   * Gera nova master seed e retorna mnemonic (UMA VEZ)
   */
  async generateNewSeed() {
    if (this.isInitialized()) {
      throw new Error('Master seed já configurada');
    }

    // Gera mnemonic BIP39 (24 palavras)
    const { mnemonic, encryptedSeed } = MasterSeedService.generateMasterSeed();

    // NOVO: Criar platform wallets automaticamente
    console.log('[MASTER SEED ADMIN] Creating platform wallets...');
    const { platformWalletService } = await import('./platformWallet.service');
    await platformWalletService.createPlatformWallets();

    const platformWallets = await platformWalletService.getAllPlatformWallets();

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'MASTER_SEED_CREATED',
        resource: 'MASTER_SEED',
        description: 'Master seed gerada via admin panel',
        userId: 'SYSTEM',
        success: true,
        metadata: JSON.stringify({
          method: 'GENERATED',
          timestamp: new Date().toISOString(),
          platformWalletsCreated: platformWallets.length,
        }),
      },
    });

    // Retorna mnemonic (ÚNICA VEZ que usuário verá) + platform wallets
    return {
      success: true,
      mnemonic: mnemonic.split(' '), // Array de 24 palavras
      encryptedSeed, // Para salvar em .env
      platformWallets: platformWallets.map((w) => ({
        cryptoType: w.cryptoType,
        network: w.network,
        address: w.address,
      })),
      warning: 'Guarde estas palavras em local seguro. Não será possível recuperá-las.',
    };
  }

  /**
   * Recupera seed a partir de mnemonic
   */
  async recoverFromMnemonic(mnemonic: string) {
    // Valida mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Mnemonic inválido');
    }

    // Testa derivação para garantir que é a seed correta
    const testResult = await this.testDerivationAgainstExistingWallets(mnemonic);

    if (testResult.totalTested > 0 && !testResult.matches) {
      throw new Error(
        `Mnemonic não corresponde às carteiras existentes no sistema (${testResult.matchedWallets}/${testResult.totalTested} matched)`
      );
    }

    // Recupera seed criptografado
    const encryptedSeed = MasterSeedService.recoverFromMnemonic(mnemonic);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'MASTER_SEED_RECOVERED',
        resource: 'MASTER_SEED',
        description: 'Master seed recuperada de mnemonic',
        userId: 'ADMIN',
        success: true,
        metadata: JSON.stringify({
          walletsMatched: testResult.matchedWallets,
          walletsTest: testResult.totalTested,
        }),
      },
    });

    return {
      success: true,
      message: 'Master seed recuperada com sucesso',
      encryptedSeed, // Para salvar em .env
      stats: {
        walletsMatched: testResult.matchedWallets,
        usersAffected: testResult.usersAffected,
      },
    };
  }

  /**
   * Testa derivação sem modificar nada
   */
  async testDerivation(mnemonic?: string) {
    // Se não passou mnemonic, testa com o atual do sistema
    const mnemonicToTest = mnemonic;

    if (!mnemonicToTest) {
      return {
        success: false,
        message: 'Mnemonic não fornecido',
      };
    }

    // Valida
    if (!bip39.validateMnemonic(mnemonicToTest)) {
      throw new Error('Mnemonic inválido');
    }

    // Deriva algumas carteiras de teste
    const testWallets = [];
    const networks = ['BITCOIN', 'ETHEREUM', 'BASE', 'ARBITRUM', 'SOLANA'];

    // Temporariamente sobrescreve o seed para testar
    // NOTA: Isso é apenas para teste, não altera o seed real
    const originalEncryptedSeed = process.env.MASTER_SEED_ENCRYPTED;
    process.env.MASTER_SEED_ENCRYPTED = MasterSeedService.recoverFromMnemonic(mnemonicToTest);

    try {
      for (const network of networks) {
        const { address, privateKey } = DerivationService.deriveWallet(
          'test-user-id',
          network === 'BITCOIN' ? 'BTC' : 'USDT',
          network
        );

        testWallets.push({
          network,
          address,
          privateKey: privateKey.substring(0, 10) + '...', // Truncado
        });
      }
    } finally {
      // Restaura seed original
      if (originalEncryptedSeed) {
        process.env.MASTER_SEED_ENCRYPTED = originalEncryptedSeed;
      }
    }

    return {
      success: true,
      testWallets,
    };
  }

  /**
   * Testa se mnemonic corresponde a carteiras existentes
   */
  private async testDerivationAgainstExistingWallets(mnemonic: string) {
    // Busca algumas carteiras existentes
    const existingWallets = await prisma.userWallet.findMany({
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    if (existingWallets.length === 0) {
      return { matches: true, matchedWallets: 0, totalTested: 0, usersAffected: 0 };
    }

    let matchedCount = 0;

    // Temporariamente sobrescreve o seed para testar
    const originalEncryptedSeed = process.env.MASTER_SEED_ENCRYPTED;
    process.env.MASTER_SEED_ENCRYPTED = MasterSeedService.recoverFromMnemonic(mnemonic);

    try {
      for (const wallet of existingWallets) {
        // Deriva carteira com mesmo userId
        const { address } = DerivationService.deriveWallet(
          wallet.userId,
          wallet.cryptoType,
          wallet.network
        );

        if (address === wallet.address) {
          matchedCount++;
        }
      }
    } finally {
      // Restaura seed original
      if (originalEncryptedSeed) {
        process.env.MASTER_SEED_ENCRYPTED = originalEncryptedSeed;
      }
    }

    const matchPercentage = (matchedCount / existingWallets.length) * 100;

    return {
      matches: matchPercentage === 100, // Deve bater 100%
      matchedWallets: matchedCount,
      totalTested: existingWallets.length,
      usersAffected: existingWallets
        .map((w) => w.userId)
        .filter((v, i, a) => a.indexOf(v) === i).length,
    };
  }

  /**
   * Retorna audit log de operações
   */
  async getAuditLog() {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'MASTER_SEED_CREATED',
            'MASTER_SEED_RECOVERED',
            'MASTER_SEED_ACCESSED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return logs;
  }

  /**
   * Verifica se master seed está inicializada
   */
  private isInitialized(): boolean {
    try {
      MasterSeedService.validateSetup();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * FASE 4: Rotaciona a encryption key da master seed
   *
   * SECURITY: Este método re-encripta a master seed com uma nova chave de criptografia.
   * É usado quando a encryption key foi comprometida ou por política de segurança.
   *
   * Processo:
   * 1. Descriptografa a master seed com a chave atual
   * 2. Gera uma nova encryption key
   * 3. Re-encripta a master seed com a nova chave
   * 4. Atualiza .env.keys com a nova chave
   * 5. Testa derivação para confirmar integridade
   *
   * @returns Nova encryption key e novo encrypted seed
   */
  async rotateEncryptionKey(): Promise<{
    success: boolean;
    newEncryptionKey: string;
    newEncryptedSeed: string;
    warning: string;
  }> {
    try {
      console.log('[MASTER SEED] Starting encryption key rotation...');

      // 1. Descriptografar master seed com chave atual
      const currentSeed = MasterSeedService.getMasterSeed();
      console.log('[MASTER SEED] Master seed decrypted successfully');

      // 2. Gerar nova encryption key (32 bytes = 64 hex chars)
      const newEncryptionKey = crypto.randomBytes(32).toString('hex');
      console.log('[MASTER SEED] New encryption key generated');

      // 3. Converter seed de volta para mnemonic para re-encriptar
      // IMPORTANTE: O seed é um Buffer de 64 bytes derivado do mnemonic
      // Para re-encriptar, precisamos usar o método interno do MasterSeedService

      // Backup da chave atual antes de rotacionar
      const fs = require('fs');
      const path = require('path');
      const envKeysPath = path.join(process.cwd(), '.env.keys');
      const backupPath = path.join(process.cwd(), `.env.keys.backup-${Date.now()}`);

      if (fs.existsSync(envKeysPath)) {
        fs.copyFileSync(envKeysPath, backupPath);
        console.log(`[MASTER SEED] Backup created: ${backupPath}`);
      }

      // 4. Re-encriptar seed com nova chave
      // Atualizamos a encryption key no service
      (MasterSeedService as any).ENCRYPTION_KEY = newEncryptionKey;

      // Re-encriptamos o seed usando o método privado
      const newEncryptedSeed = (MasterSeedService as any).encryptSeed(currentSeed);
      console.log('[MASTER SEED] Master seed re-encrypted with new key');

      // 5. Atualizar .env.keys com nova chave
      const newEnvKeysContent = `# SECURITY: Master Seed Encryption Key
# Este arquivo deve ser armazenado SEPARADAMENTE do .env em produção
# Recomendações:
# - Servidor separado (VPS, Raspberry Pi, etc)
# - Acesso via SSH/VPN apenas
# - Backup em local físico seguro
#
# Rotacionado em: ${new Date().toISOString()}
# Algoritmo: AES-256-GCM

MASTER_SEED_ENCRYPTION_KEY=${newEncryptionKey}
`;

      fs.writeFileSync(envKeysPath, newEnvKeysContent, 'utf-8');
      console.log('[MASTER SEED] .env.keys updated with new encryption key');

      // 6. Testar derivação para confirmar integridade
      console.log('[MASTER SEED] Testing derivation with new key...');

      // Forçar re-inicialização para carregar nova chave
      MasterSeedService.initialize();

      // Limpar cache
      (MasterSeedService as any).cachedMasterSeed = null;
      (MasterSeedService as any).cacheExpiry = null;

      // Testar derivação
      const testWallet = DerivationService.deriveWallet('BITCOIN', 0);
      console.log(`[MASTER SEED] Test derivation successful: ${testWallet.address}`);

      // Audit log
      auditLogService.log({
        action: 'MASTER_SEED_KEY_ROTATED',
        entityType: 'MASTER_SEED',
        userId: 'system',
        details: {
          timestamp: new Date().toISOString(),
          backupPath,
        },
      });

      return {
        success: true,
        newEncryptionKey,
        newEncryptedSeed,
        warning:
          'IMPORTANTE: Atualize o MASTER_SEED_ENCRYPTED no .env com o novo valor retornado. ' +
          'Backup da chave anterior salvo em: ' +
          backupPath,
      };
    } catch (error: any) {
      console.error('[MASTER SEED] Encryption key rotation failed:', error);
      throw new Error(`Falha ao rotacionar encryption key: ${error.message}`);
    }
  }
}

export const masterSeedAdminService = new MasterSeedAdminService();
