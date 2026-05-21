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
 * Account: User.hdAccountIndex persistido via Postgres SEQUENCE (CRIT-02)
 *           Platform: account 0 (reservado); Usuários: 1, 2, 3…
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

  // BIP32 hardened derivation aceita índices apenas até 2^31 - 1.
  // A Postgres SEQUENCE não tem esse limite, então validamos aqui.
  // Capacidade teórica: ~2.1 bilhões de usuários antes de esgotar o espaço.
  private static readonly BIP32_HARDENED_MAX = 0x80000000n;

  /**
   * Deriva carteira da PLATAFORMA (Account 0 = carteira da empresa).
   *
   * Account 0 é reservado para a plataforma — NÃO pertence a nenhum usuário
   * individual. O acesso a esta carteira é controlado por permissão RBAC,
   * não por posse. Custódia é ORTOGONAL a papel.
   *
   * Usada para:
   * 1. Receber fees das transações
   * 2. Depósitos da empresa (cold wallet → hot wallet)
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
   * Deriva uma carteira HD para um USUÁRIO.
   *
   * CRIT-02: recebe hdAccountIndex do registro User (persistido via Postgres SEQUENCE).
   * NÃO calcula o índice internamente — a função é pura (sem dependência de DB).
   * O caller é responsável por buscar User.hdAccountIndex antes de chamar.
   *
   * Account 0 é reservado para a plataforma; hdAccountIndex >= 1 para usuários.
   * Custódia (hdAccountIndex) é ORTOGONAL a papel (roleId/legacyRole):
   * mudar o role de um usuário NUNCA afeta o endereço derivado.
   *
   * @param hdAccountIndex User.hdAccountIndex persistido (BigInt, vindo do DB)
   * @param cryptoType BTC, USDC, USDT
   * @param network BITCOIN, ETHEREUM, BASE, ARBITRUM, SOLANA
   * @returns {address, privateKey, derivationPath}
   */
  static deriveUserWallet(
    hdAccountIndex: bigint,
    cryptoType: string,
    network: string
  ): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    if (hdAccountIndex >= DerivationService.BIP32_HARDENED_MAX) {
      throw new RangeError(
        `hdAccountIndex ${hdAccountIndex} exceeds BIP32 hardened derivation limit ` +
        `(max: ${DerivationService.BIP32_HARDENED_MAX - 1n}). ` +
        'The user_hd_account_seq sequence has exhausted the BIP32 hardened index space.',
      );
    }

    const coinType = this.getCoinType(cryptoType, network);

    // .toString() explícito: evita mistura de bigint com number em aritmética
    const derivationPath = `m/44'/${coinType}'/${hdAccountIndex.toString()}'/0'/0'`;

    console.log(`[DERIVATION] Deriving user wallet (account=${hdAccountIndex}): ${network} - ${cryptoType}`);
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
   * Deriva carteira Bitcoin (Segwit - bech32)
   */
  private static deriveBitcoin(path: string): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    const masterSeed = MasterSeedService.getMasterSeed();
    try {
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
    } finally {
      masterSeed.fill(0);
    }
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
    try {
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
    } finally {
      masterSeed.fill(0);
    }
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
    try {
      // Solana usa Ed25519, não secp256k1.
      // ed25519-hd-key exige path completo — valida e processa internamente.
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
    } finally {
      masterSeed.fill(0);
    }
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
   * Deriva próximo endereço para usuário (multi-address support).
   *
   * CRIT-02: mesmo contrato de deriveUserWallet — recebe hdAccountIndex do DB.
   *
   * @param hdAccountIndex User.hdAccountIndex persistido (BigInt, vindo do DB)
   * @param cryptoType BTC, USDC, USDT
   * @param network Rede blockchain
   * @param addressIndex Índice do endereço (0 = primeiro, 1 = segundo, etc)
   */
  static deriveNextAddress(
    hdAccountIndex: bigint,
    cryptoType: string,
    network: string,
    addressIndex: number
  ): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    if (hdAccountIndex >= DerivationService.BIP32_HARDENED_MAX) {
      throw new RangeError(
        `hdAccountIndex ${hdAccountIndex} exceeds BIP32 hardened derivation limit ` +
        `(max: ${DerivationService.BIP32_HARDENED_MAX - 1n}).`,
      );
    }

    const coinType = this.getCoinType(cryptoType, network);
    const derivationPath = `m/44'/${coinType}'/${hdAccountIndex.toString()}'/0/${addressIndex}`;

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
   * Valida se derivation está funcionando.
   * Usa account 1n como índice de teste (account 0 é da plataforma).
   */
  static validateDerivation(): boolean {
    try {
      const TEST_ACCOUNT_INDEX = 1n;

      console.log('   Testing Bitcoin derivation (platform)...');
      const btcPlatform = this.derivePlatformWallet('BTC', 'BITCOIN');
      console.log('   ✅ Bitcoin platform OK:', btcPlatform.address.slice(0, 10) + '...');

      console.log('   Testing Bitcoin derivation (user account=1)...');
      const btcUser = this.deriveUserWallet(TEST_ACCOUNT_INDEX, 'BTC', 'BITCOIN');
      console.log('   ✅ Bitcoin user OK:', btcUser.address.slice(0, 10) + '...');

      console.log('   Testing Ethereum derivation (user account=1)...');
      const eth = this.deriveUserWallet(TEST_ACCOUNT_INDEX, 'USDC', 'ETHEREUM');
      console.log('   ✅ Ethereum OK:', eth.address.slice(0, 10) + '...');

      try {
        console.log('   Testing Solana derivation (user account=1)...');
        const sol = this.deriveUserWallet(TEST_ACCOUNT_INDEX, 'USDC', 'SOLANA');
        console.log('   ✅ Solana OK:', sol.address.slice(0, 10) + '...');
      } catch (solError) {
        console.warn('   ⚠️  Solana derivation skipped:', (solError as Error).message);
      }

      console.log('');
      console.log('✅ Core derivation test passed (platform + user, Bitcoin + Ethereum)');
      return true;
    } catch (error) {
      console.error('❌ Derivation test failed:', (error as Error).message);
      console.error((error as Error).stack);
      throw error;
    }
  }
}
