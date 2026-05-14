import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllCryptoData,
  fetchCryptoPrices,
  fetchBTCFees,
  fetchSOLFees,
  fetchETHFees,
  CryptoData,
} from '@/services/cryptoPriceService';

/**
 * Custom hook for fetching and auto-updating crypto prices and network fees
 *
 * Update intervals:
 * - Prices: Every 30 minutes
 * - Fees: Every 15 minutes
 */
export function useCryptoPrices() {
  const [data, setData] = useState<CryptoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch initial data (prices + fees)
   */
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const cryptoData = await fetchAllCryptoData();
      setData(cryptoData);
    } catch (err) {
      console.error('Error fetching crypto data:', err);
      setError('Failed to fetch crypto data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update only prices (called every 30 minutes)
   */
  const updatePrices = useCallback(async () => {
    if (!data) return;

    try {
      const prices = await fetchCryptoPrices();
      setData(prev => prev ? {
        ...prev,
        prices,
        lastUpdated: {
          ...prev.lastUpdated,
          prices: new Date(),
        },
      } : prev);
    } catch (err) {
      console.error('Error updating prices:', err);
    }
  }, [data]);

  /**
   * Update only fees (called every 15 minutes)
   * Requires current prices to calculate USD values
   */
  const updateFees = useCallback(async () => {
    if (!data) return;

    try {
      const [btcFees, solFees, ethFees] = await Promise.all([
        fetchBTCFees(data.prices.btc),
        fetchSOLFees(data.prices.sol),
        fetchETHFees(data.prices.eth),
      ]);

      setData(prev => prev ? {
        ...prev,
        fees: {
          btc: btcFees,
          sol: solFees,
          eth: ethFees,
        },
        lastUpdated: {
          ...prev.lastUpdated,
          fees: new Date(),
        },
      } : prev);
    } catch (err) {
      console.error('Error updating fees:', err);
    }
  }, [data]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  /**
   * Setup auto-update intervals
   */
  useEffect(() => {
    if (!data) return;

    // Update prices every 30 minutes (1800000 ms)
    const pricesInterval = setInterval(() => {
      console.log('[CryptoPrices] Updating prices...');
      updatePrices();
    }, 30 * 60 * 1000);

    // Update fees every 15 minutes (900000 ms)
    const feesInterval = setInterval(() => {
      console.log('[CryptoPrices] Updating fees...');
      updateFees();
    }, 15 * 60 * 1000);

    // Cleanup intervals on unmount
    return () => {
      clearInterval(pricesInterval);
      clearInterval(feesInterval);
    };
  }, [data, updatePrices, updateFees]);

  /**
   * Manual refresh function (if needed)
   */
  const refresh = useCallback(async () => {
    await fetchInitialData();
  }, [fetchInitialData]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
