'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import CryptoIcon from '@/components/ui/CryptoIcon';
import { CryptoType } from '@mktplace/shared';
import { formatBRL } from '@/utils/formatters';
import ThemeToggle from '@/components/ThemeToggle';
import AppHeader from '@/components/AppHeader';

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

  // Internal balance state
  const [internalBalance, setInternalBalance] = useState<any>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Balance decision modal state
  const [showBalanceDecisionModal, setShowBalanceDecisionModal] = useState(false);
  const [balanceDecisionData, setBalanceDecisionData] = useState<any>(null);

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

  // Carregar saldo interno quando mudar cripto ou rede
  useEffect(() => {
    fetchInternalBalance();
  }, [crypto, network]);

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

  const fetchInternalBalance = async () => {
    if (!crypto || !network) return;

    setLoadingBalance(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('⚠️ Token não encontrado - usuário não autenticado');
        setInternalBalance(null);
        return;
      }

      const response = await fetch(
        `http://localhost:3001/api/v1/collateral-balance/${crypto}/${network}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        console.log(`💰 Saldo interno carregado: ${data.data.balance.availableBalance} ${crypto}`);
        setInternalBalance(data.data.balance);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar saldo interno:', error);
      setInternalBalance(null);
    } finally {
      setLoadingBalance(false);
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
      // Validações básicas antes de enviar
      if (!brlAmount || parseFloat(brlAmount) <= 0) {
        throw new Error('Valor em BRL deve ser maior que zero');
      }

      if (!cryptoAmount || parseFloat(cryptoAmount) <= 0) {
        throw new Error('Não foi possível calcular o valor em criptomoeda. Aguarde o carregamento dos preços.');
      }

      if (orderType === 'PIX' && !pixKey) {
        throw new Error('Chave PIX é obrigatória');
      }

      console.log('✅ Validações básicas passaram:', {
        brlAmount,
        cryptoAmount,
        crypto,
        network,
        orderType,
        pixKeyType,
        pixKey: pixKey ? 'Presente' : 'Ausente',
      });

      // Verificar se está autenticado primeiro
      const token = localStorage.getItem('accessToken');
      console.log('🔐 Token de autenticação:', token ? 'Presente' : 'Ausente');

      if (!token) {
        throw new Error('Você precisa fazer login para criar um pedido');
      }

      // NOVO: Primeiro verificar se tem saldo interno suficiente
      console.log('💰 Verificando saldo interno...');

      // Calcular colateral necessário (cryptoAmount + 2.5% de taxa)
      const requiredCollateral = (parseFloat(cryptoAmount) * 1.025).toFixed(8);

      const checkBalanceResponse = await fetch(
        `http://localhost:3001/api/v1/collateral-balance/check-sufficient/${crypto}/${network}/${requiredCollateral}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const balanceData = await checkBalanceResponse.json();
      console.log('💰 Saldo disponível:', balanceData);

      // CASO 1: TEM SALDO SUFICIENTE → Mostrar modal de decisão
      if (balanceData.success && balanceData.data.hasSufficient) {
        console.log('✅ Saldo suficiente! Mostrando opções ao usuário...');

        // Abrir modal de decisão
        setBalanceDecisionData(balanceData.data);
        setShowBalanceDecisionModal(true);
        setLoading(false);
        return;
      }

      // CASO 2: NÃO TEM SALDO OU INSUFICIENTE → Fluxo de depósito externo
      console.log('⚠️ Saldo insuficiente ou inexistente. Gerando endereço de depósito...');

      if (balanceData.success && balanceData.data.available !== '0') {
        // Tem saldo, mas não suficiente
        const shouldContinue = confirm(
          `⚠️ Saldo Insuficiente\n\n` +
          `Você tem: ${balanceData.data.available} ${crypto}\n` +
          `Falta: ${balanceData.data.missing} ${crypto}\n\n` +
          `Deseja depositar a diferença e usar seu saldo automaticamente?`
        );

        if (!shouldContinue) {
          setLoading(false);
          return;
        }
      }

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
        type: 'SELL',
        paymentMethod: orderType,
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

  // Handler: Usar saldo interno para criar pedido
  const handleUseInternalBalance = async () => {
    try {
      setLoading(true);
      setShowBalanceDecisionModal(false);

      const token = localStorage.getItem('accessToken');

      const createOrderResponse = await fetch('http://localhost:3001/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'SELL',
          paymentMethod: orderType,
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
          useInternalBalance: true,
        }),
      });

      const createData = await createOrderResponse.json();

      if (createData.success && createData.data) {
        alert('✅ Pedido criado com sucesso usando seu saldo interno!\n\nSeu pedido já está no marketplace!');
        router.push(`/orders/${createData.data.id}`);
      } else {
        if (createData.details && createData.details.length > 0) {
          const errorDetails = createData.details
            .map((d: any) => `• ${d.field}: ${d.message}`)
            .join('\n');
          throw new Error(`${createData.message}\n\nDetalhes:\n${errorDetails}`);
        }
        throw new Error(createData.message || 'Erro ao criar pedido');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Fazer depósito específico
  const handleMakeNewDeposit = async () => {
    try {
      setShowBalanceDecisionModal(false);
      setLoading(true);

      const token = localStorage.getItem('accessToken');

      // Gerar endereço de depósito para colateral
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

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar endereço de depósito');
      }

      // Salvar dados do pedido
      sessionStorage.setItem('pendingOrder', JSON.stringify({
        type: 'SELL',
        paymentMethod: orderType,
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
      setTimeLeft(1800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Se estiver na tela de depósito de colateral
  if (showCollateralDeposit && collateralAddress) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Deposite o Colateral</h1>
              <p className="text-gray-600 dark:text-gray-300">
                Envie {collateralAddress.expectedAmount} {collateralAddress.cryptoType} para o endereço abaixo
              </p>
            </div>

            {/* Timer */}
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4 mb-6 text-center">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">Tempo restante para depósito:</p>
              <p className={`text-4xl font-bold ${timeLeft < 300 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                {formatTime(timeLeft)}
              </p>
            </div>

            {/* Endereço de depósito */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Endereço de depósito ({collateralAddress.cryptoNetwork}):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={collateralAddress.address}
                  readOnly
                  className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(collateralAddress.address);
                    alert('Endereço copiado!');
                  }}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
                >
                  📋 Copiar
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="mb-6">
              <div className="flex flex-col items-center">
                <div className="bg-white border-4 border-gray-300 dark:border-gray-600 p-6 rounded-lg shadow-lg">
                  <QRCodeSVG
                    value={collateralAddress.address}
                    size={256}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 text-center">
                  Escaneie o QR Code com sua carteira de {collateralAddress.cryptoType}
                </p>
              </div>
            </div>

            {/* Instruções */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">📌 Instruções:</h3>
              <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                <li>Envie exatamente {collateralAddress.expectedAmount} {collateralAddress.cryptoType}</li>
                <li>Use a rede {collateralAddress.cryptoNetwork}</li>
                <li>O pedido será criado automaticamente após confirmação</li>
                <li>Você tem {formatTime(timeLeft)} para completar o depósito</li>
              </ol>
            </div>

            {/* Botões de ação */}
            <div className="space-y-3">
              {/* Aviso sobre simulação */}
              <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
                <h4 className="font-bold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  MODO DE TESTE
                </h4>
                <p className="text-sm text-green-900 dark:text-green-300 mb-3">
                  Este botão simula que o depósito foi confirmado na blockchain.
                  Use para testar o fluxo completo sem fazer um depósito real.
                </p>
                <p className="text-xs text-green-800 dark:text-green-200 font-semibold">
                  ✅ O que vai acontecer:
                </p>
                <ul className="text-xs text-green-800 dark:text-green-200 list-disc list-inside mt-1 space-y-1">
                  <li>Sistema marca o colateral como CONFIRMADO</li>
                  <li>Pedido é criado automaticamente</li>
                  <li>Pedido aparece no marketplace</li>
                </ul>
              </div>

              <button
                onClick={handleSimulatePayment}
                disabled={checkingPayment}
                className="w-full py-4 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-bold rounded-lg disabled:opacity-50 text-lg"
              >
                {checkingPayment ? '🔄 Simulando pagamento...' : '⚡ SIMULAR PAGAMENTO (TESTE)'}
              </button>

              <button
                onClick={() => {
                  setShowCollateralDeposit(false);
                  sessionStorage.removeItem('pendingOrder');
                }}
                className="w-full py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg"
              >
                Cancelar
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Modal de decisão de saldo
  const BalanceDecisionModal = () => {
    if (!showBalanceDecisionModal || !balanceDecisionData) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💰</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Você quer usar seu saldo existente?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Você tem saldo disponível para criar este pedido instantaneamente
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">Disponível:</span>
              <span className="text-lg font-bold text-green-900 dark:text-green-100">
                {balanceDecisionData.available} {crypto}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">Necessário:</span>
              <span className="text-lg font-bold text-green-900 dark:text-green-100">
                {balanceDecisionData.required} {crypto}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleUseInternalBalance}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
            >
              <span className="text-xl">✅</span>
              <span>Sim, use e crie o pedido diretamente</span>
            </button>

            <button
              onClick={handleMakeNewDeposit}
              disabled={loading}
              className="w-full py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-xl">💳</span>
              <span>Não, quero fazer um depósito específico</span>
            </button>

            <button
              onClick={() => {
                setShowBalanceDecisionModal(false);
                setLoading(false);
              }}
              className="w-full py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        {/* Modal de decisão de saldo */}
        <BalanceDecisionModal />

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Criar Novo Pedido</h1>
          <div className="flex gap-4">
            <ThemeToggle />
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg"
            >
              Voltar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Pagamento
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setOrderType('PIX')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                      orderType === 'PIX'
                        ? 'bg-blue-600 dark:bg-blue-700 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('BOLETO')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                      orderType === 'BOLETO'
                        ? 'bg-blue-600 dark:bg-blue-700 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Código de Barras do Boleto
                      {barcodeValidating && <span className="text-blue-600 dark:text-blue-400 text-xs ml-2">Validando...</span>}
                      {barcodeValid === true && <span className="text-green-600 dark:text-green-400 text-xs ml-2">✓ Válido</span>}
                      {barcodeValid === false && <span className="text-red-600 dark:text-red-400 text-xs ml-2">✗ Inválido</span>}
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Digite ou cole o código de barras (47 ou 48 dígitos)"
                      minLength={44}
                      required
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900 dark:text-white ${
                        barcodeValid === true
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                          : barcodeValid === false
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                      }`}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Os dados do boleto serão extraídos automaticamente
                    </p>
                  </div>

                  {/* Upload opcional de imagem */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ou faça upload da imagem do boleto (opcional)
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        className={`flex-1 px-4 py-2 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
                          uploadingImage
                            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {uploadingImage ? '📤 Processando imagem...' : '📷 Clique para selecionar imagem'}
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      OCR extrairá código de barras, valor, vencimento e beneficiário automaticamente
                    </p>
                  </div>
                </div>
              )}

              {/* Valor em BRL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor em BRL
                  {orderType === 'BOLETO' && barcodeValid && <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(preenchido automaticamente)</span>}
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
                  className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white ${
                    orderType === 'BOLETO' && barcodeValid === true ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-700'
                  }`}
                />
              </div>

              {/* Criptomoeda e Rede */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Criptomoeda
                  </label>
                  <div className="space-y-2">
                    {['BTC', 'USDC', 'USDT'].map((c) => (
                      <div
                        key={c}
                        onClick={() => setCrypto(c)}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                          crypto === c
                            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                        }`}
                      >
                        <CryptoIcon crypto={c as CryptoType} size={24} />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {c === 'BTC' && 'Bitcoin (BTC)'}
                          {c === 'USDC' && 'USD Coin (USDC)'}
                          {c === 'USDT' && 'Tether (USDT)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rede</label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de Chave PIX
                    </label>
                    <select
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="EMAIL">Email</option>
                      <option value="PHONE">Telefone</option>
                      <option value="RANDOM">Chave Aleatória</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Chave PIX
                    </label>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="Digite a chave PIX"
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nome do Beneficiário
                    </label>
                    <input
                      type="text"
                      value={pixRecipientName}
                      onChange={(e) => setPixRecipientName(e.target.value)}
                      placeholder="Nome completo"
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {/* Campos adicionais específicos Boleto */}
              {orderType === 'BOLETO' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data de Vencimento
                      {barcodeValid && dueDate && <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(preenchido automaticamente)</span>}
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nome do Beneficiário
                    </label>
                    <input
                      type="text"
                      value={boletoRecipientName}
                      onChange={(e) => setBoletoRecipientName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      CPF/CNPJ do Beneficiário
                    </label>
                    <input
                      type="text"
                      value={boletoRecipientDocument}
                      onChange={(e) => setBoletoRecipientDocument(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? 'Gerando endereço...' : '🔒 Depositar Colateral em Cripto'}
              </button>
            </form>
          </div>

          {/* Resumo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-fit">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Resumo</h2>
            <div className="space-y-3">
              {/* Saldo Disponível */}
              {internalBalance && parseFloat(internalBalance.availableBalance) > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-4 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">💰</span>
                    <h3 className="font-bold text-green-800 dark:text-green-200">
                      Saldo Disponível
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-green-700 dark:text-green-300">Total:</p>
                      <p className="text-lg font-bold text-green-900 dark:text-green-100">
                        {internalBalance.balance} {crypto}
                      </p>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-green-700 dark:text-green-300">Disponível:</span>
                      <span className="font-semibold text-green-800 dark:text-green-200">
                        {internalBalance.availableBalance} {crypto}
                      </span>
                    </div>
                    {parseFloat(internalBalance.lockedAmount) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-700 dark:text-orange-300">Bloqueado:</span>
                        <span className="font-semibold text-orange-800 dark:text-orange-200">
                          {internalBalance.lockedAmount} {crypto}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                    <p className="text-xs text-green-700 dark:text-green-300">
                      ✨ Use seu saldo interno e economize até 99% em taxas de rede!
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-2">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">Como funciona:</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Você deposita {crypto} como garantia. Alguém paga seu {orderType === 'PIX' ? 'PIX' : 'boleto'}.
                  Após confirmação, seu {crypto} é liberado para quem pagou.
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Valor do {orderType === 'PIX' ? 'PIX' : 'boleto'}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatBRL(brlAmount || '0')}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Você vai depositar (bruto)</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {cryptoAmount} {crypto}
                </p>
              </div>

              <hr className="border-gray-200 dark:border-gray-700" />

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Taxa da plataforma (1.5%)</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {fees.platformFee} {crypto}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Recompensa do pagador (1%)</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {fees.payerReward} {crypto}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Taxa total (2.5%)</p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {fees.totalFee} {crypto}
                </p>
              </div>

              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3 mt-3">
                <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Você recebe:</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Seu {orderType === 'PIX' ? 'PIX' : 'boleto'} de {formatBRL(brlAmount || '0')} pago!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
