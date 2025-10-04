export enum CryptoType {
  BTC = 'BTC',
  ETH = 'ETH',
  XMR = 'XMR',
  ZEC = 'ZEC',
  USDC = 'USDC',
  USDT = 'USDT',
}

export enum Network {
  BITCOIN = 'BITCOIN',
  ETHEREUM = 'ETHEREUM',
  POLYGON = 'POLYGON',
  BSC = 'BSC',
  SOLANA = 'SOLANA',
  TRC20 = 'TRC20',
  MONERO = 'MONERO',
  ZCASH = 'ZCASH',
}

// Mapeamento de criptos para redes suportadas
export const CRYPTO_NETWORKS: Record<CryptoType, Network[]> = {
  [CryptoType.BTC]: [Network.BITCOIN],
  [CryptoType.ETH]: [Network.ETHEREUM],
  [CryptoType.XMR]: [Network.MONERO],
  [CryptoType.ZEC]: [Network.ZCASH],
  [CryptoType.USDC]: [Network.ETHEREUM, Network.POLYGON, Network.BSC, Network.SOLANA],
  [CryptoType.USDT]: [Network.ETHEREUM, Network.POLYGON, Network.BSC, Network.TRC20],
};

// Mapeamento de IDs do CoinGecko
export const COINGECKO_IDS: Record<CryptoType, string> = {
  [CryptoType.BTC]: 'bitcoin',
  [CryptoType.ETH]: 'ethereum',
  [CryptoType.XMR]: 'monero',
  [CryptoType.ZEC]: 'zcash',
  [CryptoType.USDC]: 'usd-coin',
  [CryptoType.USDT]: 'tether',
};

export interface PriceQuote {
  crypto: CryptoType;
  brlPrice: string;
  usdPrice: string;
  timestamp: Date;
}
