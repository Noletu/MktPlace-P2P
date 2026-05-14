import axios from 'axios';
import { Connection } from '@solana/web3.js';

export interface FeeEstimate {
  feeRate?: number; // sat/vbyte (Bitcoin) or gasPrice (EVM)
  estimatedFee: string; // Fee na unidade nativa (BTC, ETH, SOL)
  estimatedFeeUSD?: string; // Fee em USD (opcional)
  estimatedTime: string; // Tempo estimado de confirmação
}

/**
 * Fee Estimator Service
 *
 * Estima taxas de rede para transações em cada blockchain.
 * - Bitcoin: sat/vbyte via mempool.space ou BlockCypher
 * - EVM (Base/Arbitrum): gasPrice via RPC eth_gasPrice
 * - Solana: prioridade fixa (~5000 lamports = 0.000005 SOL)
 */
export class FeeEstimatorService {
  /**
   * Estima fee para qualquer rede suportada
   */
  static async estimateFee(network: string, cryptoType?: string): Promise<FeeEstimate> {
    switch (network) {
      case 'BITCOIN':
        return this.estimateBitcoinFee();
      case 'ETHEREUM':
      case 'BASE':
      case 'ARBITRUM':
        return this.estimateEVMFee(network, cryptoType);
      case 'SOLANA':
        return this.estimateSolanaFee();
      default:
        throw new Error(`Unsupported network for fee estimation: ${network}`);
    }
  }

  /**
   * Bitcoin: estima fee em sat/vbyte
   * Uma transação P2WPKH típica tem ~140 vbytes
   */
  static async estimateBitcoinFee(): Promise<FeeEstimate> {
    try {
      // Tentar mempool.space primeiro (mais confiável)
      const response = await axios.get(
        'https://mempool.space/api/v1/fees/recommended',
        { timeout: 5000 }
      );

      const feeRate = response.data.halfHourFee || 10; // sat/vbyte
      const estimatedVbytes = 140; // P2WPKH transaction size
      const estimatedFeeSats = feeRate * estimatedVbytes;
      const estimatedFeeBTC = estimatedFeeSats / 100_000_000;

      return {
        feeRate,
        estimatedFee: estimatedFeeBTC.toFixed(8),
        estimatedTime: '30-60 min',
      };
    } catch {
      // Fallback: BlockCypher
      try {
        const response = await axios.get(
          'https://api.blockcypher.com/v1/btc/main',
          { timeout: 5000 }
        );

        const feePerKB = response.data.medium_fee_per_kb || 20000;
        const feeRate = Math.ceil(feePerKB / 1000); // sat/vbyte
        const estimatedVbytes = 140;
        const estimatedFeeSats = feeRate * estimatedVbytes;
        const estimatedFeeBTC = estimatedFeeSats / 100_000_000;

        return {
          feeRate,
          estimatedFee: estimatedFeeBTC.toFixed(8),
          estimatedTime: '30-60 min',
        };
      } catch {
        // Fallback fixo
        return {
          feeRate: 10,
          estimatedFee: '0.00001400',
          estimatedTime: '30-60 min',
        };
      }
    }
  }

  /**
   * EVM: estima gas price
   * Para tokens ERC-20 (USDT/USDC), gas limit ~65000
   * Para ETH nativo, gas limit ~21000
   */
  static async estimateEVMFee(network: string, cryptoType?: string): Promise<FeeEstimate> {
    try {
      const rpcUrl = this.getEVMRpcUrl(network);

      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }, { timeout: 5000 });

      const gasPriceWei = parseInt(response.data.result, 16);

      // ERC-20 transfer usa ~65000 gas, ETH nativo ~21000
      const isToken = cryptoType && ['USDT', 'USDC'].includes(cryptoType);
      const gasLimit = isToken ? 65000 : 21000;

      const feeWei = gasPriceWei * gasLimit;
      const feeETH = feeWei / 1e18;

      // Base e Arbitrum têm fees muito baixos
      const timeEstimate = network === 'ETHEREUM' ? '5-15 min' : '1-5 min';

      return {
        feeRate: gasPriceWei,
        estimatedFee: feeETH.toFixed(18),
        estimatedTime: timeEstimate,
      };
    } catch {
      // Fallback conservador
      const fallbackFees: Record<string, string> = {
        ETHEREUM: '0.005',
        BASE: '0.0001',
        ARBITRUM: '0.0003',
      };

      return {
        estimatedFee: fallbackFees[network] || '0.001',
        estimatedTime: network === 'ETHEREUM' ? '5-15 min' : '1-5 min',
      };
    }
  }

  /**
   * Solana: fee praticamente fixa
   * Base fee: 5000 lamports (0.000005 SOL)
   * Com priority fee: ~10000 lamports
   */
  static async estimateSolanaFee(): Promise<FeeEstimate> {
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      // Solana tem fee praticamente fixa
      const fees = await connection.getRecentPrioritizationFees();
      const avgFee = fees.length > 0
        ? fees.reduce((sum, f) => sum + f.prioritizationFee, 0) / fees.length
        : 0;

      // Base fee (5000 lamports) + avg priority fee
      const totalLamports = 5000 + Math.ceil(avgFee);
      const totalSOL = totalLamports / 1e9;

      return {
        feeRate: totalLamports,
        estimatedFee: totalSOL.toFixed(9),
        estimatedTime: '1-2 min',
      };
    } catch {
      return {
        feeRate: 5000,
        estimatedFee: '0.000005000',
        estimatedTime: '1-2 min',
      };
    }
  }

  /**
   * Retorna o valor mínimo de saque por rede (para cobrir fees)
   */
  static getMinimumWithdrawal(network: string, cryptoType: string): string {
    if (network === 'BITCOIN') {
      return '0'; // mínimo removido para testes
    }

    if (['BASE', 'ARBITRUM', 'ETHEREUM'].includes(network)) {
      if (['USDT', 'USDC'].includes(cryptoType)) {
        return '1'; // 1 USDC/USDT
      }
      return '0.001'; // ETH nativo
    }

    if (network === 'SOLANA') {
      if (['USDT', 'USDC'].includes(cryptoType)) {
        return '0.5'; // 0.5 USDC/USDT
      }
      return '0.01'; // SOL nativo
    }

    return '0';
  }

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
