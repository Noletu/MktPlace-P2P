export type CryptoType = 'BTC' | 'USDT' | 'USDC';
export type NetworkType = 'BITCOIN' | 'ETHEREUM' | 'BASE' | 'ARBITRUM' | 'SOLANA';

interface ExplorerConfig {
  name: string;
  baseUrl: string;
  txPath: string; // Path para transação: 'tx' ou 'transaction'
}

const EXPLORERS: Record<NetworkType, ExplorerConfig> = {
  BITCOIN: {
    name: 'Blockchain.info',
    baseUrl: 'https://blockchain.info',
    txPath: 'tx',
  },
  ETHEREUM: {
    name: 'Etherscan',
    baseUrl: 'https://etherscan.io',
    txPath: 'tx',
  },
  BASE: {
    name: 'BaseScan',
    baseUrl: 'https://basescan.org',
    txPath: 'tx',
  },
  ARBITRUM: {
    name: 'Arbiscan',
    baseUrl: 'https://arbiscan.io',
    txPath: 'tx',
  },
  SOLANA: {
    name: 'Solscan',
    baseUrl: 'https://solscan.io',
    txPath: 'tx',
  },
};

/**
 * Gera URL do blockchain explorer para uma transação
 */
export function getExplorerUrl(network: NetworkType, txHash: string): string {
  const explorer = EXPLORERS[network];
  if (!explorer) {
    console.warn(`Explorer não configurado para rede: ${network}`);
    return '#';
  }

  return `${explorer.baseUrl}/${explorer.txPath}/${txHash}`;
}

/**
 * Gera nome do explorer para exibição
 */
export function getExplorerName(network: NetworkType): string {
  return EXPLORERS[network]?.name || 'Explorer';
}

/**
 * Trunca hash para exibição
 */
export function truncateHash(hash: string, startChars = 6, endChars = 4): string {
  if (!hash || hash.length <= startChars + endChars) {
    return hash;
  }
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}
