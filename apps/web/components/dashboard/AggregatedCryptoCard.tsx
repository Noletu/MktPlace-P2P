'use client';

interface AggregatedBalance {
  cryptoType: string;
  totalBalance: string;
  totalAvailable: string;
  totalLocked: string;
  networks: Array<{
    network: string;
    id: string;
    balance: string;
    availableAmount: string;
    lockedAmount: string;
    address: string;
  }>;
}

interface AggregatedCryptoCardProps {
  balance: AggregatedBalance;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenDeposit: (walletId: string, cryptoType: string, network: string, address: string) => void;
}

export default function AggregatedCryptoCard({
  balance,
  isExpanded,
  onToggleExpand,
  onOpenDeposit,
}: AggregatedCryptoCardProps) {
  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    return num.toFixed(8);
  };

  const hasLockedAmount = parseFloat(balance.totalLocked) > 0;
  const hasMultipleNetworks = balance.networks.length > 1;

  // Ícone por crypto
  const cryptoIcons: Record<string, string> = {
    BTC: '₿',
    USDT: '₮',
    USDC: '$',
  };

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow">
      {/* Header: Crypto + Totais */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="text-3xl">
            {cryptoIcons[balance.cryptoType] || '🔹'}
          </div>

          {/* Nome + Info */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {balance.cryptoType}
            </h3>
            {hasMultipleNetworks && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {balance.networks.length} redes
              </p>
            )}
          </div>
        </div>

        {/* Botão Expandir (só se tiver múltiplas redes) */}
        {hasMultipleNetworks && (
          <button
            onClick={onToggleExpand}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isExpanded ? 'Recolher' : 'Expandir'}
          </button>
        )}
      </div>

      {/* Saldos */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Disponível */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disponível</p>
          <p className="text-base font-bold text-green-600 dark:text-green-400">
            {formatBalance(balance.totalAvailable)}
          </p>
        </div>

        {/* Bloqueado */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bloqueado</p>
          <p className={`text-base font-bold ${hasLockedAmount ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}`}>
            {formatBalance(balance.totalLocked)}
          </p>
        </div>
      </div>

      {/* Total */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatBalance(balance.totalBalance)} {balance.cryptoType}
          </span>
        </div>

        {/* Botão Depositar (quando há apenas 1 rede) */}
        {!hasMultipleNetworks && balance.networks.length === 1 && (
          <button
            onClick={() => onOpenDeposit(
              balance.networks[0].id,
              balance.cryptoType,
              balance.networks[0].network,
              balance.networks[0].address
            )}
            className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 dark:from-green-700 dark:to-green-800 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>📥 Depositar {balance.cryptoType}</span>
          </button>
        )}
      </div>

      {/* Breakdown por rede (quando expandido) */}
      {isExpanded && hasMultipleNetworks && (
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 space-y-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Breakdown por Rede
          </p>

          {balance.networks.map((network) => (
            <div
              key={network.id}
              className="bg-white dark:bg-gray-900 rounded-lg p-3 flex justify-between items-center"
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {network.network}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Disponível: {formatBalance(network.availableAmount)}
                  {parseFloat(network.lockedAmount) > 0 && (
                    <span className="ml-2 text-orange-600 dark:text-orange-400">
                      🔒 {formatBalance(network.lockedAmount)}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatBalance(network.balance)}
                </p>

                {/* Botão Depositar Individual */}
                <button
                  onClick={() => onOpenDeposit(
                    network.id,
                    balance.cryptoType,
                    network.network,
                    network.address
                  )}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Depositar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
