import * as bitcoin from 'bitcoinjs-lib';
import {Connection, PublicKey} from '@solana/web3.js';
import axios from 'axios';

/**
 * Blockchain Service
 *
 * Serviço unificado para consultar blockchains.
 * Suporta: Bitcoin, Ethereum, Base, Arbitrum, Solana, Tron
 *
 * NOTA: Para produção, considere usar bibliotecas específicas como:
 * - ethers.js / web3.js para EVM
 * - @solana/web3.js para Solana
 * - tronweb para Tron
 */
export class BlockchainService {
  /**
   * Confirmações mínimas por rede
   */
  private static readonly MIN_CONFIRMATIONS = {
    BITCOIN: 3,
    ETHEREUM: 12,
    BASE: 10,
    ARBITRUM: 10,
    SOLANA: 15,
    TRC20: 19,
  };

  /**
   * Obtém saldo de um endereço
   *
   * @param address Endereço da carteira
   * @param network Rede blockchain
   * @returns Saldo em formato string (para precisão decimal)
   */
  static async getBalance(address: string, network: string): Promise<string> {
    switch (network) {
      case 'BITCOIN':
        return this.getBitcoinBalance(address);

      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.getEVMBalance(address, network);

      case 'SOLANA':
        return this.getSolanaBalance(address);

      case 'TRC20':
        return this.getTronBalance(address);

      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  /**
   * Obtém transações de um endereço (desde um bloco específico)
   *
   * @param address Endereço da carteira
   * @param network Rede blockchain
   * @param fromBlock Bloco inicial (opcional)
   * @returns Lista de transações
   */
  static async getTransactions(
    address: string,
    network: string,
    fromBlock?: number
  ): Promise<BlockchainTransaction[]> {
    switch (network) {
      case 'BITCOIN':
        return this.getBitcoinTransactions(address);

      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.getEVMTransactions(address, network, fromBlock);

      case 'SOLANA':
        return this.getSolanaTransactions(address);

      case 'TRC20':
        return this.getTronTransactions(address);

      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  /**
   * Verifica status de uma transação
   *
   * @param txHash Hash da transação
   * @param network Rede blockchain
   * @returns Status da transação
   */
  static async getTransactionStatus(
    txHash: string,
    network: string
  ): Promise<TransactionStatus> {
    switch (network) {
      case 'BITCOIN':
        return this.getBitcoinTxStatus(txHash);

      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.getEVMTxStatus(txHash, network);

      case 'SOLANA':
        return this.getSolanaTxStatus(txHash);

      case 'TRC20':
        return this.getTronTxStatus(txHash);

      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  // ============================================
  // BITCOIN
  // ============================================

  private static async getBitcoinBalance(address: string): Promise<string> {
    try {
      // Usar BlockCypher API (free tier)
      const response = await axios.get(
        `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`
      );

      // Converter satoshis para BTC
      const satoshis = response.data.balance || 0;
      const btc = satoshis / 100000000;

      return btc.toString();
    } catch (error) {
      console.error('Error fetching Bitcoin balance:', error);
      return '0';
    }
  }

  private static async getBitcoinTransactions(
    address: string
  ): Promise<BlockchainTransaction[]> {
    try {
      const response = await axios.get(
        `https://api.blockcypher.com/v1/btc/main/addrs/${address}/full?limit=50`
      );

      const txs = response.data.txs || [];

      return txs.map((tx: any) => ({
        hash: tx.hash,
        from: tx.inputs[0]?.addresses[0] || '',
        to: address,
        value: this.calculateBTCValue(tx, address),
        blockHeight: tx.block_height,
        confirmations: tx.confirmations || 0,
        timestamp: new Date(tx.confirmed || tx.received),
      }));
    } catch (error) {
      console.error('Error fetching Bitcoin transactions:', error);
      return [];
    }
  }

  private static calculateBTCValue(tx: any, address: string): string {
    // Calcular valor recebido pelo endereço
    const outputs = tx.outputs || [];
    const received = outputs
      .filter((out: any) => out.addresses?.includes(address))
      .reduce((sum: number, out: any) => sum + (out.value || 0), 0);

    return (received / 100000000).toString(); // Converter para BTC
  }

  private static async getBitcoinTxStatus(
    txHash: string
  ): Promise<TransactionStatus> {
    try {
      const response = await axios.get(
        `https://api.blockcypher.com/v1/btc/main/txs/${txHash}`
      );

      const confirmations = response.data.confirmations || 0;
      const minConf = this.MIN_CONFIRMATIONS.BITCOIN;

      return {
        confirmed: confirmations >= minConf,
        confirmations,
        blockHeight: response.data.block_height,
      };
    } catch (error) {
      console.error('Error fetching Bitcoin tx status:', error);
      return {confirmed: false, confirmations: 0};
    }
  }

  // ============================================
  // EVM (Ethereum, Base, Arbitrum)
  // ============================================

  private static async getEVMBalance(
    address: string,
    network: string
  ): Promise<string> {
    try {
      const rpcUrl = this.getEVMRpcUrl(network);
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      });

      // Converter hex para decimal e depois para ETH
      const weiBalance = parseInt(response.data.result, 16);
      const ethBalance = weiBalance / 1e18;

      return ethBalance.toString();
    } catch (error) {
      console.error(`Error fetching ${network} balance:`, error);
      return '0';
    }
  }

  private static async getEVMTransactions(
    address: string,
    network: string,
    fromBlock?: number
  ): Promise<BlockchainTransaction[]> {
    // SIMPLIFICADO: Para produção, use APIs como Etherscan, Basescan, etc
    // Aqui retornamos array vazio e deixamos o worker consultar periodicamente o saldo
    console.warn(
      `EVM transaction history not implemented for ${network}. Use block explorer API.`
    );
    return [];
  }

  private static async getEVMTxStatus(
    txHash: string,
    network: string
  ): Promise<TransactionStatus> {
    try {
      const rpcUrl = this.getEVMRpcUrl(network);

      // Buscar receipt da transação
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      });

      if (!response.data.result) {
        return {confirmed: false, confirmations: 0};
      }

      const receipt = response.data.result;
      const blockNumber = parseInt(receipt.blockNumber, 16);

      // Buscar último bloco
      const latestBlockResponse = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      });

      const latestBlock = parseInt(latestBlockResponse.data.result, 16);
      const confirmations = latestBlock - blockNumber;

      const minConf = this.MIN_CONFIRMATIONS[network as keyof typeof this.MIN_CONFIRMATIONS] || 12;

      return {
        confirmed: confirmations >= minConf,
        confirmations,
        blockHeight: blockNumber,
      };
    } catch (error) {
      console.error(`Error fetching ${network} tx status:`, error);
      return {confirmed: false, confirmations: 0};
    }
  }

  private static getEVMRpcUrl(network: string): string {
    // URLs públicas (rate limited) - Para produção, use Infura/Alchemy
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

  // ============================================
  // SOLANA
  // ============================================

  private static async getSolanaBalance(address: string): Promise<string> {
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);

      // Converter lamports para SOL
      const sol = balance / 1e9;

      return sol.toString();
    } catch (error) {
      console.error('Error fetching Solana balance:', error);
      return '0';
    }
  }

  private static async getSolanaTransactions(
    address: string
  ): Promise<BlockchainTransaction[]> {
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      const publicKey = new PublicKey(address);
      const signatures = await connection.getSignaturesForAddress(publicKey, {
        limit: 50,
      });

      const transactions: BlockchainTransaction[] = [];

      for (const sig of signatures) {
        transactions.push({
          hash: sig.signature,
          from: '',
          to: address,
          value: '0', // Precisaria parsear a transação completa
          blockHeight: sig.slot,
          confirmations: sig.confirmationStatus === 'finalized' ? 32 : 0,
          timestamp: new Date((sig.blockTime || 0) * 1000),
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error fetching Solana transactions:', error);
      return [];
    }
  }

  private static async getSolanaTxStatus(
    txHash: string
  ): Promise<TransactionStatus> {
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      const status = await connection.getSignatureStatus(txHash);

      if (!status.value) {
        return {confirmed: false, confirmations: 0};
      }

      const confirmations = status.value.confirmations || 0;
      const finalized = status.value.confirmationStatus === 'finalized';

      return {
        confirmed: finalized,
        confirmations,
        blockHeight: undefined,
      };
    } catch (error) {
      console.error('Error fetching Solana tx status:', error);
      return {confirmed: false, confirmations: 0};
    }
  }

  // ============================================
  // TRON
  // ============================================

  private static async getTronBalance(address: string): Promise<string> {
    try {
      const response = await axios.get(
        `https://api.trongrid.io/v1/accounts/${address}`
      );

      const balance = response.data.data[0]?.balance || 0;
      const trx = balance / 1e6;

      return trx.toString();
    } catch (error) {
      console.error('Error fetching Tron balance:', error);
      return '0';
    }
  }

  private static async getTronTransactions(
    address: string
  ): Promise<BlockchainTransaction[]> {
    try {
      const response = await axios.get(
        `https://api.trongrid.io/v1/accounts/${address}/transactions?limit=50`
      );

      const txs = response.data.data || [];

      return txs.map((tx: any) => ({
        hash: tx.txID,
        from: tx.raw_data?.contract[0]?.parameter?.value?.owner_address || '',
        to: address,
        value: ((tx.raw_data?.contract[0]?.parameter?.value?.amount || 0) / 1e6).toString(),
        blockHeight: tx.blockNumber,
        confirmations: tx.ret[0]?.contractRet === 'SUCCESS' ? 19 : 0,
        timestamp: new Date(tx.block_timestamp),
      }));
    } catch (error) {
      console.error('Error fetching Tron transactions:', error);
      return [];
    }
  }

  private static async getTronTxStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const response = await axios.get(
        `https://api.trongrid.io/wallet/gettransactionbyid?value=${txHash}`
      );

      const success = response.data.ret[0]?.contractRet === 'SUCCESS';

      return {
        confirmed: success,
        confirmations: success ? 19 : 0,
        blockHeight: response.data.blockNumber,
      };
    } catch (error) {
      console.error('Error fetching Tron tx status:', error);
      return {confirmed: false, confirmations: 0};
    }
  }
}

// Types
export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockHeight?: number;
  confirmations: number;
  timestamp: Date;
}

export interface TransactionStatus {
  confirmed: boolean;
  confirmations: number;
  blockHeight?: number;
}
