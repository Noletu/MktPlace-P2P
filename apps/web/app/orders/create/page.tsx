'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';
import { formatBRL } from '@/utils/formatters';

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
  const [barcodeValidating, setBarcodeValidating] = useState(false);
  const [barcodeValid, setBarcodeValid] = useState<boolean | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Collateral deposit state
  const [showCollateralDeposit, setShowCollateralDeposit] = useState(false);
  const [collateralAddress, setCollateralAddress] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutos em segundos
  const [checkingPayment, setCheckingPayment] = useState(false);

  const NETWORK_OPTIONS: Record<string, string[]> = {
    BTC: ['BITCOIN'],
    USDC: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
    USDT: ['ETHEREUM', 'TRC20', 'BASE', 'ARBITRUM', 'SOLANA'],
  };

  useEffect(() => {
    setNetwork(NETWORK_OPTIONS[crypto][0]);
  }, [crypto]);

  useEffect(() => {
    fetchPrices();
  }, []);

  // Validar código de barras quando mudar
  useEffect(() => {
    const validateBarcodeDebounced = async () => {
      if (orderType !== 'BOLETO') return;

      const cleanBarcode = barcode.replace(/\D/g, '');
      if (cleanBarcode.length < 44) {
        setBarcodeValid(null);
        return;
      }

      setBarcodeValidating(true);
      setBarcodeValid(null);

      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.error('❌ Token not found');
          setBarcodeValid(false);
          return;
        }

        const response = await fetch('http://localhost:3001/api/v1/boleto/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ codigo: cleanBarcode }),
        });

        const data = await response.json();

        if (data.success) {
          setBarcodeValid(true);

          // Preencher automaticamente os dados extraídos
          if (data.data.valor) {
            setBrlAmount(data.data.valor);
            console.log('✅ Valor extraído do boleto: R$', data.data.valor);
          }

          if (data.data.vencimento) {
            const vencDate = new Date(data.data.vencimento);
            const formatted = vencDate.toISOString().split('T')[0];
            setDueDate(formatted);
            console.log('✅ Vencimento extraído:', formatted);
          }

          console.log('✅ Código de barras válido:', data.data.tipoBoleto);
        } else {
          setBarcodeValid(false);
          console.error('❌ Código de barras inválido:', data.error);
        }
      } catch (err) {
        console.error('❌ Erro ao validar código de barras:', err);
        setBarcodeValid(false);
      } finally {
        setBarcodeValidating(false);
      }
    };

    const timer = setTimeout(validateBarcodeDebounced, 500);
    return () => clearTimeout(timer);
  }, [barcode, orderType]);

  // Upload de imagem do boleto para OCR
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 5MB');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Você precisa fazer login para fazer upload');
        return;
      }

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('http://localhost:3001/api/v1/boleto/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data) {
        console.log('✅ Dados extraídos via OCR:', data.data);

        // Preencher código de barras
        if (data.data.codigo) {
          setBarcode(data.data.codigo);
        }

        // Preencher valor
        if (data.data.valor) {
          setBrlAmount(data.data.valor);
        }

        // Preencher vencimento
        if (data.data.vencimento) {
          const vencDate = new Date(data.data.vencimento);
          const formatted = vencDate.toISOString().split('T')[0];
          setDueDate(formatted);
        }

        // Preencher beneficiário
        if (data.data.beneficiario) {
          setBoletoRecipientName(data.data.beneficiario);
        }

        alert('✅ Dados extraídos da imagem com sucesso!');
      } else {
        setError(data.error || 'Erro ao processar imagem do boleto');
      }
    } catch (err: any) {
      console.error('❌ Erro ao fazer upload:', err);
      setError('Erro ao processar imagem. Tente novamente.');
    } finally {
      setUploadingImage(false);
      // Limpar input para permitir re-upload
      e.target.value = '';
    }
  };

  const fetchPrices = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/prices');
      const data = await response.json();
      console.log('📊 Prices API response:', data);
      if (data.success) {
        const priceMap: any = {};
        data.data.forEach((p: any) => {
          priceMap[p.crypto] = parseFloat(p.brlPrice);
        });
        console.log('💰 Price map:', priceMap);
        setPrices(priceMap);
      }
    } catch (err) {
      console.error('Erro ao buscar preços:', err);
    }
  };

  // Calcular valor em crypto (reativo com useMemo)
  const cryptoAmount = useMemo(() => {
    if (!brlAmount || !prices[crypto]) {
      console.log(`⚠️ Cannot calculate: brlAmount=${brlAmount}, crypto=${crypto}, price=${prices[crypto]}`);
      return '0';
    }
    const brl = parseFloat(brlAmount);
    const price = parseFloat(prices[crypto]);
    if (isNaN(brl) || isNaN(price) || price === 0) {
      return '0';
    }
    // USDC e USDT: 2 casas decimais, BTC: 8 casas decimais
    const decimals = (crypto === 'USDC' || crypto === 'USDT') ? 2 : 8;
    // Incluir 2.5% de taxa: divide por 0.975 para que o valor líquido seja o desejado
    const result = (brl / price / 0.975).toFixed(decimals);
    console.log(`💱 Converting R$${brl} with ${crypto} @ ${price}: ${result} ${crypto}`);
    return result;
  }, [brlAmount, crypto, prices]);

  // Calcular taxas (reativo com useMemo)
  const fees = useMemo(() => {
    const amount = parseFloat(cryptoAmount);
    const decimals = (crypto === 'USDC' || crypto === 'USDT') ? 2 : 8;
    return {
      platformFee: (amount * 0.015).toFixed(decimals),
      payerReward: (amount * 0.01).toFixed(decimals),
      totalFee: (amount * 0.025).toFixed(decimals),
      netAmount: (amount * 0.975).toFixed(decimals),
    };
  }, [cryptoAmount, crypto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Verificar se está autenticado primeiro
      const token = localStorage.getItem('accessToken');
      console.log('🔐 Token de autenticação:', token ? 'Presente' : 'Ausente');

      if (!token) {
        throw new Error('Você precisa fazer login para criar um pedido');
      }

      // Usar o cryptoAmount calculado pelo useMemo
      // Gerar endereço de depósito para colateral
      console.log('🔐 Gerando endereço de colateral...', {
        cryptoType: crypto,
        cryptoNetwork: network,
        expectedAmount: cryptoAmount,
      });

      const response = await fetch('http://localhost:3001/api/v1/collateral/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cryptoType: crypto,
          cryptoNetwork: network,
          expectedAmount: cryptoAmount,
        }),
      });

      const data = await response.json();
      console.log('📡 Resposta do servidor:', data);

      if (!response.ok) {
        console.error('❌ Erro na resposta:', response.status, data);
        throw new Error(data.error || 'Erro ao gerar endereço de depósito');
      }

      // Salvar dados do pedido para usar após confirmação do depósito
      sessionStorage.setItem('pendingOrder', JSON.stringify({
        type: 'BUY', // Sempre BUY para simplificar
        cryptoType: crypto,
        cryptoNetwork: network,
        cryptoAmount,
        brlAmount,
        orderData: orderType === 'PIX' ? {
          pixKey,
          pixKeyType,
          recipientName: pixRecipientName,
        } : {
          barcode,
          dueDate,
          recipientName: boletoRecipientName,
          recipientDocument: boletoRecipientDocument,
        },
        collateralAddressId: data.data.id,
      }));

      setCollateralAddress(data.data);
      setShowCollateralDeposit(true);
      setTimeLeft(1800); // Reset timer
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!showCollateralDeposit || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showCollateralDeposit, timeLeft]);

  // Verificar pagamento periodicamente
  useEffect(() => {
    if (!showCollateralDeposit || !collateralAddress) return;

    const checkPayment = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(
          `http://localhost:3001/api/v1/collateral/${collateralAddress.id}/status`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (data.success && data.data.status === 'CONFIRMED') {
          // Pagamento confirmado! Criar pedido
          await createOrderAfterDeposit();
        }
      } catch (err) {
        console.error('Erro ao verificar pagamento:', err);
      }
    };

    // Verificar a cada 10 segundos
    const interval = setInterval(checkPayment, 10000);

    return () => clearInterval(interval);
  }, [showCollateralDeposit, collateralAddress]);

  const createOrderAfterDeposit = async () => {
    try {
      const pendingOrderData = sessionStorage.getItem('pendingOrder');
      if (!pendingOrderData) {
        throw new Error('Dados do pedido não encontrados');
      }

      const pendingOrder = JSON.parse(pendingOrderData);

      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...pendingOrder,
          collateralAddressId: collateralAddress.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar pedido');
      }

      sessionStorage.removeItem('pendingOrder');
      alert('✅ Depósito confirmado! Pedido criado com sucesso!');
      router.push('/orders/my-orders');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSimulatePayment = async () => {
    setCheckingPayment(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `http://localhost:3001/api/v1/collateral/${collateralAddress.id}/simulate-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('⚠️ Pagamento simulado! Criando pedido...');
        await createOrderAfterDeposit();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCheckingPayment(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Se estiver na tela de depósito de colateral
  if (showCollateralDeposit && collateralAddress) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-2">Deposite o Colateral</h1>
              <p className="text-gray-600">
                Envie {collateralAddress.expectedAmount} {collateralAddress.cryptoType} para o endereço abaixo
              </p>
            </div>

            {/* Timer */}
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6 text-center">
              <p className="text-sm text-yellow-800 mb-2">Tempo restante para depósito:</p>
              <p className={`text-4xl font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-yellow-600'}`}>
                {formatTime(timeLeft)}
              </p>
            </div>

            {/* Endereço de depósito */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endereço de depósito ({collateralAddress.cryptoNetwork}):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={collateralAddress.address}
                  readOnly
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg font-mono text-sm bg-gray-50"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(collateralAddress.address);
                    alert('Endereço copiado!');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  📋 Copiar
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="mb-6">
              <div className="flex flex-col items-center">
                <div className="bg-white border-4 border-gray-300 p-6 rounded-lg shadow-lg">
                  <QRCodeSVG
                    value={collateralAddress.address}
                    size={256}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                <p className="text-sm text-gray-600 mt-3 text-center">
                  Escaneie o QR Code com sua carteira de {collateralAddress.cryptoType}
                </p>
              </div>
            </div>

            {/* Instruções */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">📌 Instruções:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Envie exatamente {collateralAddress.expectedAmount} {collateralAddress.cryptoType}</li>
                <li>Use a rede {collateralAddress.cryptoNetwork}</li>
                <li>O pedido será criado automaticamente após confirmação</li>
                <li>Você tem {formatTime(timeLeft)} para completar o depósito</li>
              </ol>
            </div>

            {/* Botões de ação */}
            <div className="space-y-3">
              {/* Aviso sobre simulação */}
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  MODO DE TESTE
                </h4>
                <p className="text-sm text-green-900 mb-3">
                  Este botão simula que o depósito foi confirmado na blockchain.
                  Use para testar o fluxo completo sem fazer um depósito real.
                </p>
                <p className="text-xs text-green-800 font-semibold">
                  ✅ O que vai acontecer:
                </p>
                <ul className="text-xs text-green-800 list-disc list-inside mt-1 space-y-1">
                  <li>Sistema marca o colateral como CONFIRMADO</li>
                  <li>Pedido é criado automaticamente</li>
                  <li>Pedido aparece no marketplace</li>
                </ul>
              </div>

              <button
                onClick={handleSimulatePayment}
                disabled={checkingPayment}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 text-lg"
              >
                {checkingPayment ? '🔄 Simulando pagamento...' : '⚡ SIMULAR PAGAMENTO (TESTE)'}
              </button>

              <button
                onClick={() => {
                  setShowCollateralDeposit(false);
                  sessionStorage.removeItem('pendingOrder');
                }}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg"
              >
                Cancelar
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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

              {/* Código de Barras - PRIMEIRO para boleto */}
              {orderType === 'BOLETO' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Barras do Boleto
                      {barcodeValidating && <span className="text-blue-600 text-xs ml-2">Validando...</span>}
                      {barcodeValid === true && <span className="text-green-600 text-xs ml-2">✓ Válido</span>}
                      {barcodeValid === false && <span className="text-red-600 text-xs ml-2">✗ Inválido</span>}
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Digite ou cole o código de barras (47 ou 48 dígitos)"
                      minLength={44}
                      required
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                        barcodeValid === true
                          ? 'border-green-500 bg-green-50'
                          : barcodeValid === false
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Os dados do boleto serão extraídos automaticamente
                    </p>
                  </div>

                  {/* Upload opcional de imagem */}
                  <div className="border-t border-gray-200 pt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ou faça upload da imagem do boleto (opcional)
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        className={`flex-1 px-4 py-2 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
                          uploadingImage
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                        <span className="text-sm text-gray-600">
                          {uploadingImage ? '📤 Processando imagem...' : '📷 Clique para selecionar imagem'}
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      OCR extrairá código de barras, valor, vencimento e beneficiário automaticamente
                    </p>
                  </div>
                </div>
              )}

              {/* Valor em BRL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor em BRL
                  {orderType === 'BOLETO' && barcodeValid && <span className="text-xs text-gray-500 ml-2">(preenchido automaticamente)</span>}
                </label>
                <input
                  type="number"
                  value={brlAmount}
                  onChange={(e) => setBrlAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="10"
                  required
                  readOnly={orderType === 'BOLETO' && barcodeValid === true}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    orderType === 'BOLETO' && barcodeValid === true ? 'bg-gray-100' : ''
                  }`}
                />
              </div>

              {/* Criptomoeda e Rede */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criptomoeda
                  </label>
                  <div className="space-y-2">
                    {['BTC', 'USDC', 'USDT'].map((c) => (
                      <div
                        key={c}
                        onClick={() => setCrypto(c)}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                          crypto === c
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        <CryptoIcon crypto={c as CryptoType} size={24} />
                        <span className="font-medium">
                          {c === 'BTC' && 'Bitcoin (BTC)'}
                          {c === 'USDC' && 'USD Coin (USDC)'}
                          {c === 'USDT' && 'Tether (USDT)'}
                        </span>
                      </div>
                    ))}
                  </div>
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

              {/* Campos adicionais específicos Boleto */}
              {orderType === 'BOLETO' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data de Vencimento
                      {barcodeValid && dueDate && <span className="text-xs text-gray-500 ml-2">(preenchido automaticamente)</span>}
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
                {loading ? 'Gerando endereço...' : '🔒 Depositar Colateral em Cripto'}
              </button>
            </form>
          </div>

          {/* Resumo */}
          <div className="bg-white rounded-lg shadow-md p-6 h-fit">
            <h2 className="text-xl font-bold mb-4">Resumo</h2>
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                <p className="text-xs font-semibold text-blue-800 mb-1">Como funciona:</p>
                <p className="text-xs text-blue-700">
                  Você deposita {crypto} como garantia. Alguém paga seu {orderType === 'PIX' ? 'PIX' : 'boleto'}.
                  Após confirmação, seu {crypto} é liberado para quem pagou.
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Valor do {orderType === 'PIX' ? 'PIX' : 'boleto'}</p>
                <p className="text-xl font-bold">{formatBRL(brlAmount || '0')}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Você vai depositar (bruto)</p>
                <p className="text-lg font-semibold">
                  {cryptoAmount} {crypto}
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
                <p className="text-sm text-green-600">
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

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <p className="text-xs font-semibold text-green-800 mb-1">✅ Você recebe:</p>
                <p className="text-xs text-green-700">
                  Seu {orderType === 'PIX' ? 'PIX' : 'boleto'} de {formatBRL(brlAmount || '0')} pago!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
