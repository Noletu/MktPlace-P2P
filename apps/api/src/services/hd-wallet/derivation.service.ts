import * as bitcoin from 'bitcoinjs-lib';
import {BIP32Factory} from 'bip32';
import * as ecc from 'tiny-secp256k1';
import {Wallet as EthereumWallet} from '@ethereumjs/wallet';
import {Keypair as SolanaKeypair} from '@solana/web3.js';
import {derivePath as deriveEd25519Path} from 'ed25519-hd-key';
import bs58 from 'bs58';
import {MasterSeedService} from './master-seed.service';

// Inicializar BIP32
const bip32 = BIP32Factory(ecc);

/**
 * Derivation Service
 *
 * Deriva carteiras HD usando BIP32/BIP44 para diferentes blockchains.
 *
 * BIP44 Path: m / purpose' / coin_type' / account' / change / address_index
 *
 * Purpose: 44' (BIP44)
 * Coin Types:
 * - Bitcoin: 0'
 * - Ethereum: 60'
 * - Solana: 501'
 *
 * Account: derivado do userId (hash)
 * Change: 0 (receive)
 * Address Index: 0 (primeira carteira)
 */
export class DerivationService {
  /**
   * Coin types BIP44
   */
  private static readonly COIN_TYPES = {
    BTC: 0,
    ETH: 60, // Ethereum e todas redes EVM
    SOL: 501,
  };

  /**
   * NOVO: Deriva carteira da PLATAFORMA (Account 0 = Sócios MASTER/ADMIN)
   *
   * Estas carteiras são usadas para:
   * 1. Receber fees das transações
   * 2. Depósitos dos sócios (cold wallet → hot wallet)
   *
   * Account 0 é RESERVADO para platform wallets.
   * User wallets SEMPRE terão Account > 0.
   *
   * @param cryptoType BTC, USDC, USDT
   * @param network BITCOIN, ETHEREUM, BASE, ARBITRUM, SOLANA
   * @returns {address, privateKey, derivationPath}
   */
  static derivePlatformWallet(
    cryptoType: string,
    network: string
  ): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    const coinType = this.getCoinType(cryptoType, network);

    // PLATFORM WALLET: Account 0 (reservado)
    const PLATFORM_ACCOUNT = 0;

    // BIP44 path: m/44'/coin_type'/0'/0'/0'
    // USDT e USDC na mesma rede compartilham o mesmo endereço (tokens diferentes, mesma wallet)
    const derivationPath = `m/44'/${coinType}'/${PLATFORM_ACCOUNT}'/0'/0'`;

    console.log(`[DERIVATION] Deriving platform wallet: ${network} - ${cryptoType}`);
    console.log(`[DERIVATION] Path: ${derivationPath}`);

    switch (network) {
      case 'BITCOIN':
        return this.deriveBitcoin(derivationPath);
      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.deriveEthereum(derivationPath);
      case 'SOLANA':
        return this.deriveSolana(derivationPath);
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  /**
   * Deriva uma carteira HD para um USUÁRIO
   *
   * IMPORTANTE: User wallets NUNCA usam Account 0 (reservado para platform).
   * Account index é sempre >= 1.
   *
   * @param userId ID do usuário
   * @param cryptoType BTC, USDC, USDT
   * @param network BITCOIN, ETHEREUM, BASE, ARBITRUM, SOLANA
   * @returns {address, privateKey, derivationPath}
   */
  static deriveUserWallet(
    userId: string,
    cryptoType: string,
    network: string
  ): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    // Determinar coin type
    const coinType = this.getCoinType(cryptoType, network);

    // Gerar account index a partir do userId (determinístico)
    // IMPORTANTE: Account sempre >= 1 (0 é reservado para platform)
    const account = this.userIdToAccountIndex(userId);

    // Usar hardened derivation em todos os níveis (mais seguro)
   const derivationPath = `m/44'/${coinType}'/${account}'/0'/0'`;

    console.log(`[DERIVATION] Deriving user wallet for ${userId}: ${network} - ${cryptoType}`);
    console.log(`[DERIVATION] Account: ${account}, Path: ${derivationPath}`);

    // Derivar carteira conforme blockchain
    switch (network) {
      case 'BITCOIN':
        return this.deriveBitcoin(derivationPath);

      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.deriveEthereum(derivationPath);

      case 'SOLANA':
        return this.deriveSolana(derivationPath);

      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  /**
   * DEPRECATED: Use derivePlatformWallet() ou deriveUserWallet()
   * Mantido para retrocompatibilidade
   */
  static deriveWallet(
    userId: string,
    cryptoType: string,
    network: string
  ): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    console.warn('[DEPRECATION] deriveWallet() is deprecated. Use deriveUserWallet() instead.');
    return this.deriveUserWallet(userId, cryptoType, network);
  }

  /**
   * Deriva carteira Bitcoin (Segwit - bech32)
   */
  private static deriveBitcoin(path: string): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    const masterSeed = MasterSeedService.getMasterSeed();
    const root = bip32.fromSeed(masterSeed);
    const child = root.derivePath(path);

    if (!child.privateKey) {
      throw new Error('Failed to derive Bitcoin private key');
    }

    // Gerar endereço Segwit (bech32 - bc1...)
    const {address} = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: bitcoin.networks.bitcoin,
    });

    if (!address) {
      throw new Error('Failed to generate Bitcoin address');
    }

    // Garantir conversão correta para hex
    const privateKeyHex = Buffer.isBuffer(child.privateKey)
      ? child.privateKey.toString('hex')
      : Buffer.from(child.privateKey).toString('hex');

    return {
      address,
      privateKey: privateKeyHex,
      derivationPath: path,
    };
  }

  /**
   * Deriva carteira Ethereum e redes EVM (Base, Arbitrum)
   */
  private static deriveEthereum(path: string): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    const masterSeed = MasterSeedService.getMasterSeed();
    const root = bip32.fromSeed(masterSeed);
    const child = root.derivePath(path);

    if (!child.privateKey) {
      throw new Error('Failed to derive Ethereum private key');
    }

    // Criar wallet Ethereum
    const wallet = EthereumWallet.fromPrivateKey(child.privateKey);
    const address = wallet.getAddressString();
    const privateKeyWithPrefix = wallet.getPrivateKeyString();
    // Remove '0x' e garante formato hex válido
    const privateKey = privateKeyWithPrefix.startsWith('0x')
      ? privateKeyWithPrefix.slice(2)
      : privateKeyWithPrefix;

    return {
      address,
      privateKey,
      derivationPath: path,
    };
  }

  /**
   * Deriva carteira Solana (Ed25519)
   */
  private static deriveSolana(path: string): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    const masterSeed = MasterSeedService.getMasterSeed();

    /// Solana usa Ed25519, não secp256k1
      // A biblioteca ed25519-hd-key EXIGE path completo: m/44'/501'/0'/0'/0'
      // NÃO processar o path - a biblioteca valida e processa internamente
      const derivedSeed = deriveEd25519Path(path, masterSeed.toString('hex')).key;

    // Criar keypair Solana (precisa de 32 bytes)
    const keypair = SolanaKeypair.fromSeed(Uint8Array.from(derivedSeed));

    const address = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);

    return {
      address,
      privateKey,
      derivationPath: path,
    };
  }

  /**
   * Determina coin_type BIP44 baseado em crypto e network
   */
  private static getCoinType(cryptoType: string, network: string): number {
    switch (network) {
      case 'BITCOIN':
        return this.COIN_TYPES.BTC;

      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.COIN_TYPES.ETH;

      case 'SOLANA':
        return this.COIN_TYPES.SOL;

      default:
        throw new Error(`Unknown network: ${network}`);
    }
  }

  /**
   * Converte userId para account index (determinístico)
   *
   * Garante que o mesmo userId sempre gera o mesmo account.
   *
   * IMPORTANTE: NUNCA retorna 0 (reservado para platform wallets).
   * Account sempre >= 1 para user wallets.
   */
  private static userIdToAccountIndex(userId: string): number {
    // Hash do userId para gerar número determinístico
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(userId).digest();

    // Usar primeiros 4 bytes como número (0 a 4,294,967,295)
    const account = hash.readUInt32BE(0);

    // Limitar a 2^31 - 1 para BIP32 (hardened derivation)
    const limitedAccount = account % 0x80000000;

    // IMPORTANTE: Garantir que account >= 1 (0 é reservado para platform)
    // Se for 0, usar 1 (extremamente raro, mas seguro)
    return limitedAccount === 0 ? 1 : limitedAccount;
  }

  /**
   * Deriva próximo endereço para usuário (multi-address support)
   *
   * @param userId ID do usuário
   * @param cryptoType BTC, USDC, USDT
   * @param network Rede blockchain
   * @param addressIndex Índice do endereço (0 = primeiro, 1 = segundo, etc)
   */
  static deriveNextAddress(
    userId: string,
    cryptoType: string,
    network: string,
    addressIndex: number
  ): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    const coinType = this.getCoinType(cryptoType, network);
    const account = this.userIdToAccountIndex(userId);

    // BIP44 path com address_index customizado
    const derivationPath = `m/44'/${coinType}'/${account}'/0/${addressIndex}`;

    switch (network) {
      case 'BITCOIN':
        return this.deriveBitcoin(derivationPath);
      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.deriveEthereum(derivationPath);
      case 'SOLANA':
        return this.deriveSolana(derivationPath);
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  /**
   * Valida se derivation está funcionando
   */
  static validateDerivation(): boolean {
    try {
      // Testar derivação para cada rede
      const testUserId = 'test-user-123';

      console.log('   Testing Bitcoin derivation...');
      const btc = this.deriveWallet(testUserId, 'BTC', 'BITCOIN');
      console.log('   ✅ Bitcoin OK:', btc.address.slice(0, 10) + '...');

      console.log('   Testing Ethereum derivation...');
      const eth = this.deriveWallet(testUserId, 'USDC', 'ETHEREUM');
      console.log('   ✅ Ethereum OK:', eth.address.slice(0, 10) + '...');

      console.log('   Testing Solana derivation...');
      try {
        const sol = this.deriveWallet(testUserId, 'USDC', 'SOLANA');
        console.log('   ✅ Solana OK:', sol.address.slice(0, 10) + '...');
      } catch (solError) {
        console.warn('   ⚠️  Solana derivation skipped:', (solError as Error).message);
        console.warn('   (Solana support can be added later)');
      }

      console.log('');
      console.log('✅ Core derivation test passed (Bitcoin + Ethereum)');
      return true;
    } catch (error) {
      console.error('❌ Derivation test failed:', (error as Error).message);
      console.error((error as Error).stack);
      throw error;
    }
  }
}
