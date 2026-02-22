/**
 * Crypto Price & Network Fees Service
 *
 * Fetches cryptocurrency prices and network fees from various APIs:
 * - Prices: CoinGecko API (free tier)
 * - BTC fees: mempool.space API (free)
 * - SOL fees: Fixed/estimated (Solana fees are very low and stable)
 * - ETH L1/L2 fees: Etherscan-like gas oracle
 */

export interface CryptoPrices {
  btc: number;
  sol: number;
  eth: number;
}

export interface BTCFees {
  fastest: number;   // sat/vB
  medium: number;    // sat/vB
  slow: number;      // sat/vB
  estimatedUSD: {
    fastest: number;
    medium: number;
    slow: number;
  };
}

export interface SOLFees {
  lamports: number;
  estimatedUSD: number;
}

export interface ETHFees {
  l1: {
    gwei: number;
    estimatedUSD: number;
  };
  l2: {
    gwei: number;
    estimatedUSD: number;
  };
}

export interface CryptoData {
  prices: CryptoPrices;
  fees: {
    btc: BTCFees;
    sol: SOLFees;
    eth: ETHFees;
  };
  lastUpdated: {
    prices: Date;
    fees: Date;
  };
}

/**
 * Fetch cryptocurrency prices via backend API (avoids CORS issues with CoinGecko)
 */
export async function fetchCryptoPrices(): Promise<CryptoPrices> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

  try {
    const response = await fetch(`${API_URL}/prices`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Price API error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      throw new Error('Invalid price response');
    }

    const prices: CryptoPrices = { btc: 0, sol: 0, eth: 0 };

    for (const item of json.data) {
      const usd = parseFloat(item.usdPrice) || 0;
      if (item.crypto === 'BTC') prices.btc = usd;
      else if (item.crypto === 'SOL') prices.sol = usd;
      else if (item.crypto === 'ETH') prices.eth = usd;
    }

    return prices;
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    // Return fallback values
    return {
      btc: 0,
      sol: 0,
      eth: 0,
    };
  }
}

/**
 * Fetch Bitcoin network fees from mempool.space
 * Returns fees in sat/vB and estimated USD cost for standard transaction
 */
export async function fetchBTCFees(btcPrice: number): Promise<BTCFees> {
  try {
    const response = await fetch('https://mempool.space/api/v1/fees/recommended', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Mempool API error: ${response.status}`);
    }

    const data = await response.json();

    // Standard Bitcoin transaction size: ~140 vBytes
    const TX_SIZE_VBYTES = 140;

    // Calculate USD cost for each fee tier
    const calculateUSD = (satPerVB: number): number => {
      const sats = satPerVB * TX_SIZE_VBYTES;
      const btc = sats / 100000000; // Convert sats to BTC
      return btc * btcPrice;
    };

    return {
      fastest: data.fastestFee || 0,
      medium: data.halfHourFee || 0,
      slow: data.hourFee || 0,
      estimatedUSD: {
        fastest: calculateUSD(data.fastestFee || 0),
        medium: calculateUSD(data.halfHourFee || 0),
        slow: calculateUSD(data.hourFee || 0),
      },
    };
  } catch (error) {
    console.error('Error fetching BTC fees:', error);
    return {
      fastest: 0,
      medium: 0,
      slow: 0,
      estimatedUSD: {
        fastest: 0,
        medium: 0,
        slow: 0,
      },
    };
  }
}

/**
 * Fetch Solana network fees
 * Solana fees are extremely low and stable (~0.000005 SOL per transaction)
 */
export async function fetchSOLFees(solPrice: number): Promise<SOLFees> {
  try {
    // Solana fees are practically fixed at ~5000 lamports (0.000005 SOL)
    // We could call Solana RPC, but it's overkill for such a stable value
    const LAMPORTS_PER_SIGNATURE = 5000;
    const SOL_PER_LAMPORT = 0.000000001;

    const solFee = LAMPORTS_PER_SIGNATURE * SOL_PER_LAMPORT;
    const usdFee = solFee * solPrice;

    return {
      lamports: LAMPORTS_PER_SIGNATURE,
      estimatedUSD: usdFee,
    };
  } catch (error) {
    console.error('Error calculating SOL fees:', error);
    return {
      lamports: 5000,
      estimatedUSD: 0,
    };
  }
}

/**
 * Fetch Ethereum network fees (L1 and Base L2)
 * Uses Etherscan-style gas oracle
 */
export async function fetchETHFees(ethPrice: number): Promise<ETHFees> {
  try {
    // Standard ETH transfer gas limit: 21000
    const TRANSFER_GAS_LIMIT = 21000;
    const GWEI_TO_ETH = 0.000000001;

    // Fetch Ethereum L1 gas price
    // Note: Using a public endpoint - in production, use Infura/Alchemy with API key
    const l1Response = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    let l1Gwei = 50; // Fallback default

    if (l1Response.ok) {
      const l1Data = await l1Response.json();
      // Use ProposeGasPrice (medium speed)
      l1Gwei = parseFloat(l1Data.result?.ProposeGasPrice || '50');
    }

    // Base L2 fees are typically 100-1000x cheaper than L1
    // Estimating at ~1% of L1 cost
    const l2Gwei = l1Gwei * 0.01;

    // Calculate USD costs
    const l1EthCost = l1Gwei * TRANSFER_GAS_LIMIT * GWEI_TO_ETH;
    const l1UsdCost = l1EthCost * ethPrice;

    const l2EthCost = l2Gwei * TRANSFER_GAS_LIMIT * GWEI_TO_ETH;
    const l2UsdCost = l2EthCost * ethPrice;

    return {
      l1: {
        gwei: l1Gwei,
        estimatedUSD: l1UsdCost,
      },
      l2: {
        gwei: l2Gwei,
        estimatedUSD: l2UsdCost,
      },
    };
  } catch (error) {
    console.error('Error fetching ETH fees:', error);
    return {
      l1: {
        gwei: 50,
        estimatedUSD: 0,
      },
      l2: {
        gwei: 0.5,
        estimatedUSD: 0,
      },
    };
  }
}

/**
 * Fetch all crypto prices and network fees
 */
export async function fetchAllCryptoData(): Promise<CryptoData> {
  try {
    // Fetch prices first (needed for fee calculations)
    const prices = await fetchCryptoPrices();

    // Fetch fees in parallel (they all depend on prices)
    const [btcFees, solFees, ethFees] = await Promise.all([
      fetchBTCFees(prices.btc),
      fetchSOLFees(prices.sol),
      fetchETHFees(prices.eth),
    ]);

    return {
      prices,
      fees: {
        btc: btcFees,
        sol: solFees,
        eth: ethFees,
      },
      lastUpdated: {
        prices: new Date(),
        fees: new Date(),
      },
    };
  } catch (error) {
    console.error('Error fetching all crypto data:', error);
    throw error;
  }
}

/**
 * Format USD amount to string with appropriate precision
 */
export function formatUSD(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  if (amount < 10) return `$${amount.toFixed(2)}`;
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 10000) return `$${(amount / 1000).toFixed(2)}k`;
  return `$${(amount / 1000).toFixed(1)}k`;
}

/**
 * Format crypto price for compact display
 */
export function formatPrice(amount: number): string {
  if (amount === 0) return '$0';
  if (amount < 1) return `$${amount.toFixed(3)}`;
  if (amount < 100) return `$${amount.toFixed(2)}`;
  if (amount < 1000) return `$${amount.toFixed(0)}`;
  if (amount < 10000) return `$${(amount / 1000).toFixed(2)}k`;
  return `$${(amount / 1000).toFixed(1)}k`;
}
