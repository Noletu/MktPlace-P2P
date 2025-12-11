import * as bip39 from 'bip39';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Master Seed Service
 *
 * Gerencia o seed mestre BIP39 do sistema.
 * O seed é usado para derivar todas as carteiras HD dos usuários.
 *
 * SEGURANÇA:
 * - Seed criptografado com AES-256-GCM
 * - Chave de criptografia em variável de ambiente
 * - Seed nunca exposto em logs ou responses
 */
export class MasterSeedService {
  private static ENCRYPTION_KEY: string;
  private static IV_LENGTH = 12; // 96 bits para GCM
  private static AUTH_TAG_LENGTH = 16; // 128 bits

  // SECURITY: Memory protection - cache com TTL
  private static cachedMasterSeed: Buffer | null = null;
  private static cacheExpiry: number | null = null;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  /**
   * Inicializa o service com a chave de criptografia
   *
   * SECURITY: Tenta ler de .env.keys primeiro (separação de encryption key)
   * Se não existir, faz fallback para .env (backward compatibility)
   */
  static initialize() {
    let key: string | undefined;
    let keySource: 'env.keys' | 'env' = 'env';

    // FASE 3: Tentar ler de .env.keys primeiro (separação de chaves)
    try {
      const envKeysPath = path.join(process.cwd(), '.env.keys');

      if (fs.existsSync(envKeysPath)) {
        const envKeysContent = fs.readFileSync(envKeysPath, 'utf-8');

        // Parse simples do arquivo .env.keys
        const lines = envKeysContent.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          // Ignora comentários e linhas vazias
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [envKey, envValue] = trimmedLine.split('=');
            if (envKey?.trim() === 'MASTER_SEED_ENCRYPTION_KEY' && envValue) {
              key = envValue.trim();
              keySource = 'env.keys';
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn('[SECURITY] Failed to read .env.keys, falling back to .env:', (error as Error).message);
    }

    // Fallback para .env se não encontrou em .env.keys
    if (!key) {
      key = process.env.MASTER_SEED_ENCRYPTION_KEY;
    }

    if (!key) {
      throw new Error(
        'MASTER_SEED_ENCRYPTION_KEY not found in .env.keys or .env. ' +
        'Generate one with: openssl rand -hex 32'
      );
    }

    if (key.length !== 64) {
      throw new Error(
        'MASTER_SEED_ENCRYPTION_KEY must be 32 bytes (64 hex characters). ' +
        'Generate one with: openssl rand -hex 32'
      );
    }

    this.ENCRYPTION_KEY = key;

    // SECURITY: Log de onde a key foi carregada
    if (keySource === 'env.keys') {
      console.log('[SECURITY] ✅ Encryption key loaded from .env.keys (recommended)');
    } else {
      console.warn('[SECURITY] ⚠️  Encryption key loaded from .env. Migrate to .env.keys for better security.');
    }
  }

  /**
   * Gera um novo master seed BIP39 (24 palavras = 256 bits)
   *
   * ATENÇÃO: Execute apenas UMA VEZ no setup inicial!
   * Guarde o mnemonic em local seguro (cold storage).
   *
   * @returns Mnemonic (24 palavras) e seed criptografado
   */
  static generateMasterSeed(): {
    mnemonic: string;
    encryptedSeed: string;
  } {
    // Gerar entropy de 256 bits
    const entropy = crypto.randomBytes(32);

    // Gerar mnemonic BIP39 (24 palavras)
    const mnemonic = bip39.entropyToMnemonic(entropy);

    // Validar mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Generated invalid mnemonic');
    }

    // Converter mnemonic para seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // Criptografar seed
    const encryptedSeed = this.encryptSeed(seed);

    return {
      mnemonic, // Guardar em COLD STORAGE!
      encryptedSeed, // Armazenar em .env
    };
  }

  /**
   * Recupera e descriptografa o master seed
   *
   * SECURITY: Implementa cache com TTL de 5 minutos para evitar
   * manter o seed descriptografado em memória indefinidamente.
   *
   * @returns Seed buffer (64 bytes)
   */
  static getMasterSeed(): Buffer {
    // Verifica se cache expirou
    if (this.cachedMasterSeed && this.cacheExpiry && Date.now() > this.cacheExpiry) {
      // Limpa cache expirado
      this.cachedMasterSeed = null;
      this.cacheExpiry = null;
      console.log('[SECURITY] Master seed cache expired, will be decrypted on next access');
    }

    // Retorna cache se ainda válido
    if (this.cachedMasterSeed) {
      return this.cachedMasterSeed;
    }

    const encryptedSeed = process.env.MASTER_SEED_ENCRYPTED;

    if (!encryptedSeed) {
      throw new Error(
        'MASTER_SEED_ENCRYPTED not found in environment. ' +
        'Run generateMasterSeed() first to create one.'
      );
    }

    // Descriptografa seed
    const seed = this.decryptSeed(encryptedSeed);

    // Armazena em cache com TTL
    this.cachedMasterSeed = seed;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    console.log('[SECURITY] Master seed decrypted and cached for 5 minutes');

    return seed;
  }

  /**
   * Criptografa o seed com AES-256-GCM
   *
   * @param seed Seed buffer (64 bytes)
   * @returns Encrypted seed em formato: iv:authTag:ciphertext (hex)
   */
  private static encryptSeed(seed: Buffer): string {
    // Gerar IV aleatório
    const iv = crypto.randomBytes(this.IV_LENGTH);

    // Converter encryption key de hex para buffer
    const key = Buffer.from(this.ENCRYPTION_KEY, 'hex');

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

  /**
   * Descriptografa o seed
   *
   * @param encryptedSeed Formato: iv:authTag:ciphertext (hex)
   * @returns Seed buffer descriptografado (64 bytes)
   */
  private static decryptSeed(encryptedSeed: string): Buffer {
    // Parse encrypted seed
    const parts = encryptedSeed.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted seed format');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    // Converter encryption key de hex para buffer
    const key = Buffer.from(this.ENCRYPTION_KEY, 'hex');

    // Criar decipher AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    try {
      // Descriptografar
      const seed = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return seed;
    } catch (error) {
      throw new Error('Failed to decrypt seed. Invalid encryption key or corrupted data.');
    }
  }

  /**
   * Valida se o seed está configurado corretamente
   *
   * @returns true se seed está OK, lança erro caso contrário
   */
  static validateSetup(): boolean {
    try {
      this.initialize();
      this.getMasterSeed();
      return true;
    } catch (error) {
      console.error('❌ Master Seed setup validation failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Recupera o master seed a partir de mnemonic (recovery)
   *
   * Usado para restaurar o sistema a partir do backup do mnemonic.
   *
   * @param mnemonic Mnemonic BIP39 (24 palavras)
   * @returns Encrypted seed para armazenar em .env
   */
  static recoverFromMnemonic(mnemonic: string): string {
    // Validar mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    // Converter para seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // Criptografar
    const encryptedSeed = this.encryptSeed(seed);

    return encryptedSeed;
  }
}

// Auto-inicializar quando módulo é carregado
try {
  MasterSeedService.initialize();
} catch (error) {
  console.warn(
    '⚠️  Master Seed Service not initialized. ' +
    'Ensure MASTER_SEED_ENCRYPTION_KEY is set in .env'
  );
}
