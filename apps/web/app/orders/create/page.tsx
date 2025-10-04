'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<any>({});

  // Form state
  const [orderType, setOrderType] = useState<'PIX' | 'BOLETO'>('PIX');
  const [brlAmount, setBrlAmount] = useState('');
  const [crypto, setCrypto] = useState('BTC');
  const [network, setNetwork] = useState('BITCOIN');

  // PIX fields
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'>('CPF');
  const [pixRecipientName, setPixRecipientName] = useState('');

  // Boleto fields
  const [barcode, setBarcode] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [boletoRecipientName, setBoletoRecipientName] = useState('');
  const [boletoRecipientDocument, setBoletoRecipientDocument] = useState('');

  const NETWORK_OPTIONS: Record<string, string[]> = {
    BTC: ['BITCOIN'],
    ETH: ['ETHEREUM'],
    XMR: ['MONERO'],
    ZEC: ['ZCASH'],
    USDC: ['ETHEREUM', 'POLYGON', 'BSC', 'SOLANA'],
    USDT: ['ETHEREUM', 'POLYGON', 'BSC', 'TRC20'],
  };

  useEffect(() => {
    setNetwork(NETWORK_OPTIONS[crypto][0]);
  }, [crypto]);

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/prices');
      const data = await response.json();
      if (data.success) {
        const priceMap: any = {};
        data.data.forEach((p: any) => {
          priceMap[p.crypto] = p.brlPrice;
        });
        setPrices(priceMap);
      }
    } catch (err) {
      console.error('Erro ao buscar preços:', err);
    }
  };

  const calculateCryptoAmount = () => {
    if (!brlAmount || !prices[crypto]) return '0';
    const brl = parseFloat(brlAmount);
    const price = parseFloat(prices[crypto]);
    return (brl / price).toFixed(8);
  };

  const calculateFees = () => {
    const cryptoAmount = parseFloat(calculateCryptoAmount());
    return {
      platformFee: (cryptoAmount * 0.015).toFixed(8),
      payerReward: (cryptoAmount * 0.01).toFixed(8),
      totalFee: (cryptoAmount * 0.025).toFixed(8),
      netAmount: (cryptoAmount * 0.975).toFixed(8),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const cryptoAmount = calculateCryptoAmount();

      let orderData: any;
      if (orderType === 'PIX') {
        orderData = {
          pixKey,
          pixKeyType,
          recipientName: pixRecipientName,
        };
      } else {
        orderData = {
          barcode,
          dueDate,
          recipientName: boletoRecipientName,
          recipientDocument: boletoRecipientDocument,
        };
      }

      const response = await fetch('http://localhost:3001/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: orderType,
          cryptoType: crypto,
          cryptoNetwork: network,
          cryptoAmount,
          brlAmount,
          orderData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar pedido');
      }

      alert('Pedido criado com sucesso! Aguardando matching...');
      router.push('/orders/my-orders');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fees = calculateFees();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Criar Novo Pedido</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg"
          >
            Voltar
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Pagamento
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setOrderType('PIX')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                      orderType === 'PIX'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('BOLETO')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                      orderType === 'BOLETO'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Boleto
                  </button>
                </div>
              </div>

              {/* Valor em BRL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor em BRL
                </label>
                <input
                  type="number"
                  value={brlAmount}
                  onChange={(e) => setBrlAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="10"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Criptomoeda e Rede */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criptomoeda
                  </label>
                  <select
                    value={crypto}
                    onChange={(e) => setCrypto(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="XMR">Monero (XMR)</option>
                    <option value="ZEC">Zcash (ZEC)</option>
                    <option value="USDC">USD Coin (USDC)</option>
                    <option value="USDT">Tether (USDT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rede</label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {NETWORK_OPTIONS[crypto].map((net) => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Campos específicos PIX */}
              {orderType === 'PIX' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Chave PIX
                    </label>
                    <select
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="EMAIL">Email</option>
                      <option value="PHONE">Telefone</option>
                      <option value="RANDOM">Chave Aleatória</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chave PIX
                    </label>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="Digite a chave PIX"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Beneficiário
                    </label>
                    <input
                      type="text"
                      value={pixRecipientName}
                      onChange={(e) => setPixRecipientName(e.target.value)}
                      placeholder="Nome completo"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Campos específicos Boleto */}
              {orderType === 'BOLETO' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Barras
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Código de barras do boleto (44+ dígitos)"
                      minLength={44}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data de Vencimento
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Beneficiário
                    </label>
                    <input
                      type="text"
                      value={boletoRecipientName}
                      onChange={(e) => setBoletoRecipientName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CPF/CNPJ do Beneficiário
                    </label>
                    <input
                      type="text"
                      value={boletoRecipientDocument}
                      onChange={(e) => setBoletoRecipientDocument(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Pedido'}
              </button>
            </form>
          </div>

          {/* Resumo */}
          <div className="bg-white rounded-lg shadow-md p-6 h-fit">
            <h2 className="text-xl font-bold mb-4">Resumo</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Valor em BRL</p>
                <p className="text-xl font-bold">R$ {brlAmount || '0.00'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Você receberá (bruto)</p>
                <p className="text-lg font-semibold">
                  {calculateCryptoAmount()} {crypto}
                </p>
              </div>

              <hr />

              <div>
                <p className="text-sm text-gray-600">Taxa da plataforma (1.5%)</p>
                <p className="text-sm">
                  {fees.platformFee} {crypto}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Recompensa do pagador (1%)</p>
                <p className="text-sm">
                  {fees.payerReward} {crypto}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Taxa total (2.5%)</p>
                <p className="text-sm font-semibold text-red-600">
                  {fees.totalFee} {crypto}
                </p>
              </div>

              <hr />

              <div>
                <p className="text-sm text-gray-600">Você receberá (líquido)</p>
                <p className="text-2xl font-bold text-green-600">
                  {fees.netAmount} {crypto}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
