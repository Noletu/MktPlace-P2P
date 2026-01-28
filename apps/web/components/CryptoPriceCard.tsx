'use client';

import { useState } from 'react';
import { BTCFees, SOLFees, ETHFees } from '@/services/cryptoPriceService';

interface CryptoPriceCardProps {
  symbol: 'BTC' | 'SOL' | 'ETH';
  icon: string;
  name: string;
  price: number;
  fees: BTCFees | SOLFees | ETHFees;
  lastUpdated?: Date;
}

export default function CryptoPriceCard({
  symbol,
  icon,
  name,
  price,
  fees,
  lastUpdated,
}: CryptoPriceCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Format price for compact display
  const formatPrice = (amount: number): string => {
    if (amount === 0) return '$0';
    if (amount < 1) return `$${amount.toFixed(3)}`;
    if (amount < 100) return `$${amount.toFixed(2)}`;
    if (amount < 1000) return `$${amount.toFixed(0)}`;
    if (amount < 10000) return `$${(amount / 1000).toFixed(2)}k`;
    return `$${(amount / 1000).toFixed(1)}k`;
  };

  // Format USD fee
  const formatFee = (amount: number): string => {
    if (amount === 0) return '$0';
    if (amount < 0.01) return `$${amount.toFixed(4)}`;
    if (amount < 1) return `$${amount.toFixed(3)}`;
    return `$${amount.toFixed(2)}`;
  };

  // Get main fee to display (medium for BTC, single value for others)
  const getMainFee = (): string => {
    if (symbol === 'BTC') {
      const btcFees = fees as BTCFees;
      return formatFee(btcFees.estimatedUSD.medium);
    } else if (symbol === 'SOL') {
      const solFees = fees as SOLFees;
      return formatFee(solFees.estimatedUSD);
    } else if (symbol === 'ETH') {
      const ethFees = fees as ETHFees;
      return `L1 ${formatFee(ethFees.l1.estimatedUSD)} | L2 ${formatFee(ethFees.l2.estimatedUSD)}`;
    }
    return '$0';
  };

  // Render tooltip content based on symbol
  const renderTooltipContent = () => {
    const timeStr = lastUpdated
      ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '--:--';

    if (symbol === 'BTC') {
      const btcFees = fees as BTCFees;
      return (
        <div className="space-y-2">
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Preço: ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Taxas de Rede:</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-green-600 dark:text-green-400">🐢 Lenta ({btcFees.slow} sat/vB):</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatFee(btcFees.estimatedUSD.slow)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600 dark:text-blue-400">⚡ Média ({btcFees.medium} sat/vB):</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatFee(btcFees.estimatedUSD.medium)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-600 dark:text-orange-400">🚀 Rápida ({btcFees.fastest} sat/vB):</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatFee(btcFees.estimatedUSD.fastest)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              *Estimativa para transação padrão (~140 vB)
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Atualizado: {timeStr}</p>
          </div>
        </div>
      );
    } else if (symbol === 'SOL') {
      const solFees = fees as SOLFees;
      return (
        <div className="space-y-2">
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Preço: ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Taxa de Rede:</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Transação padrão:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatFee(solFees.estimatedUSD)}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ({solFees.lamports.toLocaleString()} lamports = {(solFees.lamports / 1000000000).toFixed(6)} SOL)
              </p>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Atualizado: {timeStr}</p>
          </div>
        </div>
      );
    } else if (symbol === 'ETH') {
      const ethFees = fees as ETHFees;
      return (
        <div className="space-y-2">
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Preço: ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Taxas de Rede:</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-blue-600 dark:text-blue-400">L1 Ethereum ({ethFees.l1.gwei.toFixed(1)} Gwei):</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatFee(ethFees.l1.estimatedUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600 dark:text-green-400">L2 Base ({ethFees.l2.gwei.toFixed(2)} Gwei):</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatFee(ethFees.l2.estimatedUSD)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              *Estimativa para transferência simples (21000 gas)
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Atualizado: {timeStr}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  // Get card colors based on crypto
  const getCardColors = () => {
    if (symbol === 'BTC') {
      return {
        bg: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20',
        border: 'border-orange-300 dark:border-orange-700',
        iconBg: 'bg-orange-500/20',
        iconText: 'text-orange-600 dark:text-orange-400',
        priceText: 'text-orange-900 dark:text-orange-100',
      };
    } else if (symbol === 'SOL') {
      return {
        bg: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20',
        border: 'border-purple-300 dark:border-purple-700',
        iconBg: 'bg-purple-500/20',
        iconText: 'text-purple-600 dark:text-purple-400',
        priceText: 'text-purple-900 dark:text-purple-100',
      };
    } else {
      return {
        bg: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20',
        border: 'border-blue-300 dark:border-blue-700',
        iconBg: 'bg-blue-500/20',
        iconText: 'text-blue-600 dark:text-blue-400',
        priceText: 'text-blue-900 dark:text-blue-100',
      };
    }
  };

  const colors = getCardColors();

  return (
    <div className="relative">
      {/* Card de Preço */}
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`${colors.bg} border ${colors.border} rounded-md px-2 py-1 shadow-sm hover:shadow-md transition-all cursor-pointer`}
      >
        <div className="flex items-center gap-2">
          {/* Ícone */}
          <div className={`${colors.iconBg} rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0`}>
            <span className={`text-sm ${colors.iconText}`}>{icon}</span>
          </div>

          {/* Preço e Taxa */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{symbol}</span>
              <span className={`text-xs font-bold ${colors.priceText}`}>{formatPrice(price)}</span>
            </div>
            {symbol === 'ETH' ? (
              <div className="flex gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                <span>L1 {formatFee((fees as ETHFees).l1.estimatedUSD)}</span>
                <span className="text-green-600 dark:text-green-400">L2 {formatFee((fees as ETHFees).l2.estimatedUSD)}</span>
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{getMainFee()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-4 animate-fadeIn">
          {renderTooltipContent()}
        </div>
      )}
    </div>
  );
}
