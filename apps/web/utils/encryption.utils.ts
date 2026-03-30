/**
 * Utilidades de criptografia end-to-end para chat
 * Usa Web Crypto API (nativa do navegador)
 */

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'chat_public_key';

export interface EncryptedMessage {
  encryptedContent: string;
  iv: string;
}

/**
 * Gerar par de chaves RSA-OAEP
 */
export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  return keyPair;
}

/**
 * Exportar chave pública para formato Base64 (para enviar ao servidor)
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey);
  const exportedAsBase64 = btoa(
    String.fromCharCode(...new Uint8Array(exported))
  );
  return exportedAsBase64;
}

/**
 * Importar chave pública de formato Base64
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));

  const publicKey = await window.crypto.subtle.importKey(
    'spki',
    binaryKey,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );

  return publicKey;
}

/**
 * Exportar chave privada para formato Base64 (para armazenar localmente)
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
  const exportedAsBase64 = btoa(
    String.fromCharCode(...new Uint8Array(exported))
  );
  return exportedAsBase64;
}

/**
 * Importar chave privada de formato Base64
 */
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const binaryKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));

  const privateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );

  return privateKey;
}

/**
 * SECURITY: Chave privada NÃO é persistida (localStorage é acessível via XSS).
 * A chave existe apenas em RAM (via useChat.privateKeyRef) por sessão.
 * Cada sessão gera um novo par de chaves e registra a nova chave pública no servidor.
 */
export async function storePrivateKey(_privateKey: CryptoKey): Promise<void> {
  // Intencionalmente vazio — chave privada fica somente em memória RAM
  // Limpar qualquer chave antiga que possa ter ficado de versões anteriores
  localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
}

/**
 * Chave privada não é persistida — retorna sempre null para forçar nova geração.
 */
export async function getPrivateKey(): Promise<CryptoKey | null> {
  return null;
}

/**
 * Armazenar chave pública localmente (para cache)
 */
export async function storePublicKey(publicKey: CryptoKey): Promise<void> {
  const exported = await exportPublicKey(publicKey);
  localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, exported);
}

/**
 * Recuperar chave pública local
 */
export async function getPublicKey(): Promise<CryptoKey | null> {
  const stored = localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
  if (!stored) return null;

  try {
    return await importPublicKey(stored);
  } catch (error) {
    console.error('Failed to import public key:', error);
    return null;
  }
}

/**
 * Criptografar mensagem com AES-GCM (mais eficiente que RSA para textos)
 * e depois criptografar a chave AES com RSA da chave pública do destinatário
 */
export async function encryptMessage(
  message: string,
  recipientPublicKey: CryptoKey
): Promise<EncryptedMessage> {
  // 1. Gerar chave AES simétrica aleatória
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // 2. Gerar IV (Initialization Vector) aleatório
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Criptografar mensagem com AES-GCM
  const encodedMessage = new TextEncoder().encode(message);
  const encryptedMessage = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    encodedMessage
  );

  // 4. Exportar chave AES
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 5. Criptografar chave AES com RSA pública do destinatário
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    recipientPublicKey,
    exportedAesKey
  );

  // 6. Combinar chave AES criptografada + mensagem criptografada
  const combined = new Uint8Array(
    encryptedAesKey.byteLength + encryptedMessage.byteLength
  );
  combined.set(new Uint8Array(encryptedAesKey), 0);
  combined.set(new Uint8Array(encryptedMessage), encryptedAesKey.byteLength);

  // 7. Converter para Base64
  const encryptedContent = btoa(String.fromCharCode(...combined));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    encryptedContent,
    iv: ivBase64,
  };
}

/**
 * Descriptografar mensagem
 */
export async function decryptMessage(
  encryptedContent: string,
  ivBase64: string,
  privateKey: CryptoKey
): Promise<string> {
  try {
    // 1. Converter de Base64
    const combined = Uint8Array.from(atob(encryptedContent), (c) =>
      c.charCodeAt(0)
    );
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));

    // 2. Separar chave AES criptografada e mensagem criptografada
    // RSA-OAEP 2048 bits = 256 bytes
    const encryptedAesKey = combined.slice(0, 256);
    const encryptedMessage = combined.slice(256);

    // 3. Descriptografar chave AES com RSA privada
    const aesKeyRaw = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedAesKey
    );

    // 4. Importar chave AES
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      aesKeyRaw,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // 5. Descriptografar mensagem com AES-GCM
    const decryptedMessage = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      encryptedMessage
    );

    // 6. Decodificar de bytes para string
    const message = new TextDecoder().decode(decryptedMessage);
    return message;
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    throw new Error('Falha ao descriptografar mensagem');
  }
}

/**
 * Verificar se navegador suporta Web Crypto API
 */
export function isCryptoSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle !== undefined
  );
}

/**
 * Limpar chaves armazenadas (útil para logout/reset)
 */
export function clearStoredKeys(): void {
  localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
  localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
}
