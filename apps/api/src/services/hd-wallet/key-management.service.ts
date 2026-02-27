import * as crypto from 'crypto';

/**
 * Key Management Service
 *
 * Gerencia criptografia/descriptografia de private keys individuais.
 *
 * SEGURANÇA:
 * - Cada private key é criptografada com AES-256-GCM
 * - Chave de criptografia derivada de master key + salt por usuário
 * - Private keys NUNCA armazenadas em plain text
 * - Private keys NUNCA expostas em logs ou responses
 */
export class KeyManagementService {
  private static MASTER_KEY: string;
  private static IV_LENGTH = 12; // 96 bits para GCM
  private static AUTH_TAG_LENGTH = 16; // 128 bits
  private static SALT_LENGTH = 32; // 256 bits

  /** ID padrão para criptografia de platform wallets (Account 0) */
  static readonly PLATFORM_ID = 'PLATFORM_SYSTEM';

  /**
   * Inicializa o service com a master key
   */
  static initialize() {
    const key = process.env.WALLET_ENCRYPTION_KEY;

    if (!key) {
      throw new Error(
        'WALLET_ENCRYPTION_KEY not found in environment. ' +
        'Generate one with: openssl rand -hex 32'
      );
    }

    if (key.length !== 64) {
      throw new Error(
        'WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex characters). ' +
        'Generate one with: openssl rand -hex 32'
      );
    }

    this.MASTER_KEY = key;
  }

  /**
   * Criptografa uma private key
   *
   * @param privateKey Private key em hex
   * @param userId ID do usuário (usado para derivar chave única)
   * @returns Encrypted private key no formato: salt:iv:authTag:ciphertext (hex)
   */
  static encryptPrivateKey(privateKey: string, userId: string = KeyManagementService.PLATFORM_ID): string {
    // Gerar salt único para este usuário
    const salt = crypto.randomBytes(this.SALT_LENGTH);

    // Derivar chave de criptografia única (master key + salt + userId)
    const derivedKey = this.deriveEncryptionKey(userId, salt);

    // Gerar IV aleatório
    const iv = crypto.randomBytes(this.IV_LENGTH);

    // Criar cipher AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

    // Converter private key para buffer
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');

    // Criptografar
    const ciphertext = Buffer.concat([
      cipher.update(privateKeyBuffer),
      cipher.final(),
    ]);

    // Obter authentication tag
    const authTag = cipher.getAuthTag();

    // Retornar: salt:iv:authTag:ciphertext (hex)
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      ciphertext.toString('hex'),
    ].join(':');
  }

  /**
   * Descriptografa uma private key
   *
   * @param encryptedPrivateKey Formato: salt:iv:authTag:ciphertext (hex)
   * @param userId ID do usuário
   * @returns Private key em hex
   */
  static decryptPrivateKey(
    encryptedPrivateKey: string,
    userId: string = KeyManagementService.PLATFORM_ID
  ): string {
    // Parse encrypted data
    const parts = encryptedPrivateKey.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted private key format');
    }

    const [saltHex, ivHex, authTagHex, ciphertextHex] = parts;

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    // Derivar mesma chave de criptografia
    const derivedKey = this.deriveEncryptionKey(userId, salt);

    // Criar decipher AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);

    try {
      // Descriptografar
      const privateKeyBuffer = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return privateKeyBuffer.toString('hex');
    } catch (error) {
      throw new Error(
        'Failed to decrypt private key. Invalid key or corrupted data.'
      );
    }
  }

  /**
   * Deriva chave de criptografia única por usuário
   *
   * Usa PBKDF2 para derivar chave a partir de:
   * - Master key (chave secreta global)
   * - Salt (único por carteira)
   * - UserId (binding adicional)
   *
   * @param userId ID do usuário
   * @param salt Salt buffer
   * @returns Chave derivada (32 bytes)
   */
  private static deriveEncryptionKey(
    userId: string,
    salt: Buffer
  ): Buffer {
    // Combinar master key + userId como material de entrada
    const inputMaterial = this.MASTER_KEY + userId;

    // Derivar chave usando PBKDF2
    const key = crypto.pbkdf2Sync(
      inputMaterial,
      salt,
      100000, // 100k iterações (balance security/performance)
      32, // 32 bytes = 256 bits
      'sha256'
    );

    return key;
  }

  /**
   * Rotaciona encryption de uma private key (re-encrypt com nova chave)
   *
   * Usado quando WALLET_ENCRYPTION_KEY é rotacionada.
   *
   * @param encryptedPrivateKey Private key criptografada antiga
   * @param userId ID do usuário
   * @param newMasterKey Nova master key
   * @returns Nova private key criptografada
   */
  static rotateKey(
    encryptedPrivateKey: string,
    userId: string,
    newMasterKey?: string
  ): string {
    // Descriptografar com chave antiga
    const privateKey = this.decryptPrivateKey(encryptedPrivateKey, userId);

    // Temporariamente trocar master key
    const oldMasterKey = this.MASTER_KEY;
    if (newMasterKey) {
      this.MASTER_KEY = newMasterKey;
    }

    // Criptografar com chave nova
    const newEncryptedPrivateKey = this.encryptPrivateKey(privateKey, userId);

    // Restaurar master key antiga
    this.MASTER_KEY = oldMasterKey;

    return newEncryptedPrivateKey;
  }

  /**
   * Valida que encryption/decryption está funcionando
   */
  static validateEncryption(): boolean {
    try {
      const testPrivateKey = crypto.randomBytes(32).toString('hex');
      const testUserId = 'test-user-123';

      // Encrypt
      const encrypted = this.encryptPrivateKey(testPrivateKey, testUserId);

      // Decrypt
      const decrypted = this.decryptPrivateKey(encrypted, testUserId);

      // Validate
      if (testPrivateKey !== decrypted) {
        throw new Error('Encryption/decryption mismatch');
      }

      console.log('✅ Key encryption test passed');
      return true;
    } catch (error) {
      console.error('❌ Key encryption test failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Gera nova master key (para setup inicial)
   *
   * @returns Hex string (64 caracteres)
   */
  static generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Auto-inicializar quando módulo é carregado
try {
  KeyManagementService.initialize();
} catch (error) {
  console.warn(
    '⚠️  Key Management Service not initialized. ' +
    'Ensure WALLET_ENCRYPTION_KEY is set in .env'
  );
}
