import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Wallet as EthereumWallet } from '@ethereumjs/wallet';
import {
  Connection,
  Keypair as SolanaKeypair,
  PublicKey,
  SystemProgram,
  Transaction as SolanaTransaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import axios from 'axios';

const bip32 = BIP32Factory(ecc);

// Endereços de contrato por rede (configuráveis via .env)
const TOKEN_CONTRACTS: Record<string, Record<string, string>> = {
  BASE: {
    USDC: process.env.USDC_CONTRACT_BASE || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: process.env.USDT_CONTRACT_BASE || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  },
  ETHEREUM: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  ARBITRUM: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
};

const SOLANA_TOKEN_MINTS: Record<string, string> = {
  USDC: process.env.USDC_CONTRACT_SOLANA || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: process.env.USDT_CONTRACT_SOLANA || 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

export interface SendTransactionResult {
  txHash: string;
  networkFee: string;
}

/**
 * Transaction Sender Service
 *
 * Assina e envia transações reais para cada blockchain.
 * - Bitcoin: PSBT via bitcoinjs-lib, UTXOs via BlockCypher
 * - EVM: Raw transaction via eth_sendRawTransaction
 * - Solana: Transaction via @solana/web3.js
 */
export class TransactionSenderService {
  // ============================================
  // BITCOIN
  // ============================================

  /**
   * Envia transação Bitcoin
   *
   * @param fromPrivateKeyHex Private key em hex
   * @param toAddress Endereço de destino (bc1..., 1..., 3...)
   * @param amountBTC Valor em BTC
   * @param feeRate Fee rate em sat/vbyte
   * @returns txHash e networkFee
   */
  static async sendBitcoinTransaction(
    fromPrivateKeyHex: string,
    fromAddress: string,
    toAddress: string,
    amountBTC: number,
    feeRate: number
  ): Promise<SendTransactionResult> {
    const network = bitcoin.networks.bitcoin;

    // 1. Buscar UTXOs do endereço
    const utxos = await this.getBitcoinUTXOs(fromAddress);
    if (utxos.length === 0) {
      throw new Error('No UTXOs available for this address');
    }

    // 2. Calcular valores
    const amountSats = Math.floor(amountBTC * 100_000_000);
    const estimatedSize = 140; // P2WPKH típico
    const feeSats = Math.ceil(feeRate * estimatedSize);

    // Selecionar UTXOs suficientes
    let totalInputSats = 0;
    const selectedUtxos: any[] = [];
    for (const utxo of utxos) {
      selectedUtxos.push(utxo);
      totalInputSats += utxo.value;
      if (totalInputSats >= amountSats + feeSats) break;
    }

    if (totalInputSats < amountSats + feeSats) {
      throw new Error(
        `Insufficient BTC balance. Need: ${(amountSats + feeSats) / 1e8} BTC, Have: ${totalInputSats / 1e8} BTC`
      );
    }

    // 3. Construir transação com PSBT
    const psbt = new bitcoin.Psbt({ network });
    const keyPair = bip32.fromPrivateKey(
      Buffer.from(fromPrivateKeyHex, 'hex'),
      Buffer.alloc(32, 0), // chaincode não é necessário para assinatura
    );

    for (const utxo of selectedUtxos) {
      // Buscar raw transaction para nonWitnessUtxo
      const rawTx = await this.getBitcoinRawTx(utxo.tx_hash);
      psbt.addInput({
        hash: utxo.tx_hash,
        index: utxo.tx_output_n,
        nonWitnessUtxo: Buffer.from(rawTx, 'hex'),
      });
    }

    // Output para destinatário
    psbt.addOutput({
      address: toAddress,
      value: BigInt(amountSats),
    });

    // Change output (troco)
    const changeSats = totalInputSats - amountSats - feeSats;
    if (changeSats > 546) { // Dust limit
      psbt.addOutput({
        address: fromAddress,
        value: BigInt(changeSats),
      });
    }

    // 4. Assinar
    for (let i = 0; i < selectedUtxos.length; i++) {
      psbt.signInput(i, {
        publicKey: Buffer.from(keyPair.publicKey),
        sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
      });
    }

    psbt.finalizeAllInputs();
    const rawTx = psbt.extractTransaction().toHex();

    // 5. Broadcast via BlockCypher
    const txHash = await this.broadcastBitcoinTx(rawTx);

    return {
      txHash,
      networkFee: (feeSats / 100_000_000).toFixed(8),
    };
  }

  private static async getBitcoinUTXOs(address: string): Promise<any[]> {
    const response = await axios.get(
      `https://api.blockcypher.com/v1/btc/main/addrs/${address}?unspentOnly=true&includeScript=true`,
      { timeout: 10000 }
    );
    return (response.data.txrefs || []).map((utxo: any) => ({
      tx_hash: utxo.tx_hash,
      tx_output_n: utxo.tx_output_n,
      value: utxo.value,
      script: utxo.script,
    }));
  }

  private static async getBitcoinRawTx(txHash: string): Promise<string> {
    const response = await axios.get(
      `https://api.blockcypher.com/v1/btc/main/txs/${txHash}?includeHex=true`,
      { timeout: 10000 }
    );
    return response.data.hex;
  }

  private static async broadcastBitcoinTx(rawTx: string): Promise<string> {
    const response = await axios.post(
      'https://api.blockcypher.com/v1/btc/main/txs/push',
      { tx: rawTx },
      { timeout: 15000 }
    );
    return response.data.tx.hash;
  }

  // ============================================
  // EVM (Base, Arbitrum, Ethereum)
  // ============================================

  /**
   * Envia transação EVM (ETH nativo ou token ERC-20)
   *
   * @param fromPrivateKeyHex Private key em hex
   * @param toAddress Endereço de destino (0x...)
   * @param amount Valor a enviar (em unidades do token ou ETH)
   * @param network Rede (BASE, ARBITRUM, ETHEREUM)
   * @param cryptoType Tipo (USDT, USDC, ou ETH)
   * @param gasPrice Gas price em wei
   * @returns txHash e networkFee
   */
  static async sendEVMTransaction(
    fromPrivateKeyHex: string,
    toAddress: string,
    amount: string,
    network: string,
    cryptoType: string,
    gasPrice?: number
  ): Promise<SendTransactionResult> {
    const rpcUrl = this.getEVMRpcUrl(network);
    const wallet = EthereumWallet.fromPrivateKey(Buffer.from(fromPrivateKeyHex, 'hex') as any);
    const fromAddress = wallet.getAddressString();

    // Obter nonce
    const nonceResponse = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_getTransactionCount',
      params: [fromAddress, 'latest'],
      id: 1,
    }, { timeout: 10000 });
    const nonce = parseInt(nonceResponse.data.result, 16);

    // Obter gasPrice se não fornecido
    if (!gasPrice) {
      const gasPriceResponse = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }, { timeout: 10000 });
      gasPrice = parseInt(gasPriceResponse.data.result, 16);
    }

    // Obter chainId
    const chainIdResponse = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1,
    }, { timeout: 10000 });
    const chainId = parseInt(chainIdResponse.data.result, 16);

    let txDataHex: string;
    let txTo: string;
    let txValue: bigint;
    let gasLimit: number;

    const isToken = ['USDT', 'USDC'].includes(cryptoType);

    if (isToken) {
      // ERC-20 transfer
      const contractAddress = TOKEN_CONTRACTS[network]?.[cryptoType];
      if (!contractAddress) {
        throw new Error(`No contract address for ${cryptoType} on ${network}`);
      }

      // USDT/USDC têm 6 decimais
      const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1e6));

      // transfer(address,uint256) function selector: 0xa9059cbb
      const paddedTo = toAddress.replace('0x', '').padStart(64, '0');
      const paddedAmount = amountInSmallestUnit.toString(16).padStart(64, '0');
      txDataHex = `0xa9059cbb${paddedTo}${paddedAmount}`;
      txTo = contractAddress;
      txValue = BigInt(0);
      gasLimit = 65000;
    } else {
      // ETH nativo
      txValue = BigInt(Math.floor(parseFloat(amount) * 1e18));
      txDataHex = '0x';
      txTo = toAddress;
      gasLimit = 21000;
    }

    // Usar @ethereumjs/tx para construir e assinar
    const { createLegacyTx } = await import('@ethereumjs/tx');

    const tx = createLegacyTx({
      nonce: BigInt(nonce),
      gasPrice: BigInt(gasPrice),
      gasLimit: BigInt(gasLimit),
      to: txTo as any,
      value: txValue,
      data: txDataHex === '0x' ? '0x' : txDataHex as any,
    });

    const privKeyBytes = Buffer.from(fromPrivateKeyHex, 'hex');
    const signedTx = tx.sign(privKeyBytes);
    const serialized = '0x' + Buffer.from(signedTx.serialize()).toString('hex');

    // Enviar
    const sendResponse = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_sendRawTransaction',
      params: [serialized],
      id: 1,
    }, { timeout: 15000 });

    if (sendResponse.data.error) {
      throw new Error(`EVM transaction failed: ${sendResponse.data.error.message}`);
    }

    const txHash = sendResponse.data.result;
    const networkFeeWei = gasPrice * gasLimit;
    const networkFeeETH = networkFeeWei / 1e18;

    return {
      txHash,
      networkFee: networkFeeETH.toFixed(18),
    };
  }

  // ============================================
  // SOLANA
  // ============================================

  /**
   * Envia transação Solana (SOL nativo ou SPL token)
   *
   * @param fromPrivateKeyHex Private key em hex
   * @param toAddress Endereço de destino (base58)
   * @param amount Valor a enviar
   * @param cryptoType SOL, USDT, ou USDC
   * @returns txHash e networkFee
   */
  static async sendSolanaTransaction(
    fromPrivateKeyHex: string,
    toAddress: string,
    amount: string,
    cryptoType: string
  ): Promise<SendTransactionResult> {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Reconstruir Keypair a partir da private key hex
    const secretKey = Buffer.from(fromPrivateKeyHex, 'hex');
    const keypair = SolanaKeypair.fromSecretKey(
      secretKey.length === 64 ? secretKey : new Uint8Array([...secretKey, ...SolanaKeypair.fromSeed(secretKey).publicKey.toBytes()])
    );

    const toPubkey = new PublicKey(toAddress);
    const isToken = ['USDT', 'USDC'].includes(cryptoType);

    let txHash: string;

    if (isToken) {
      // SPL Token transfer
      const mintStr = SOLANA_TOKEN_MINTS[cryptoType];
      if (!mintStr) {
        throw new Error(`No mint address for ${cryptoType} on Solana`);
      }
      const mint = new PublicKey(mintStr);

      // USDT/USDC no Solana tem 6 decimais
      const amountLamports = BigInt(Math.floor(parseFloat(amount) * 1e6));

      // Obter/criar ATA do destinatário
      const fromATA = await getAssociatedTokenAddress(mint, keypair.publicKey);
      const toATA = await getAssociatedTokenAddress(mint, toPubkey);

      const transaction = new SolanaTransaction();

      // Verificar se ATA do destinatário existe
      try {
        await getAccount(connection, toATA);
      } catch {
        // ATA não existe — criar
        transaction.add(
          createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            toATA,
            toPubkey,
            mint
          )
        );
      }

      // Adicionar instrução de transfer
      transaction.add(
        createTransferInstruction(
          fromATA,
          toATA,
          keypair.publicKey,
          amountLamports
        )
      );

      txHash = await sendAndConfirmTransaction(connection, transaction, [keypair], {
        commitment: 'confirmed',
      });
    } else {
      // SOL nativo
      const lamports = Math.floor(parseFloat(amount) * 1e9);

      const transaction = new SolanaTransaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: toPubkey,
          lamports,
        })
      );

      txHash = await sendAndConfirmTransaction(connection, transaction, [keypair], {
        commitment: 'confirmed',
      });
    }

    // Fee do Solana é fixa (~5000 lamports)
    const networkFee = '0.000005';

    return {
      txHash,
      networkFee,
    };
  }

  // ============================================
  // UTILS
  // ============================================

  private static getEVMRpcUrl(network: string): string {
    switch (network) {
      case 'ETHEREUM':
        return process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';
      case 'BASE':
        return process.env.BASE_RPC_URL || 'https://mainnet.base.org';
      case 'ARBITRUM':
        return process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
      default:
        throw new Error(`Unknown EVM network: ${network}`);
    }
  }
}
