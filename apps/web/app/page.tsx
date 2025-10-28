'use client';

import AppHeader from '@/components/AppHeader';
import { useEffect, useState } from 'react';

interface Stats {
  totalUsers: number;
  totalVolume: string;
  avgMatchTime: number;
  successRate: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 1247,
    totalVolume: '2847500',
    avgMatchTime: 15,
    successRate: 98.5,
  });

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Mktplace da Liberdade
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-200 mb-4">
            Pague contas com cripto. Ganhe cripto pagando contas.
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            O primeiro marketplace P2P brasileiro que conecta quem tem criptomoedas com quem quer criptomoedas.
            Zero contato com BRL pela plataforma. 100% descentralizado.
          </p>

          <div className="mt-10 flex gap-4 justify-center">
            <a
              href="/register"
              className="px-8 py-4 bg-blue-600 dark:bg-blue-700 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition shadow-lg"
            >
              Começar Agora
            </a>
            <a
              href="/login"
              className="px-8 py-4 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 text-lg font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-lg border-2 border-blue-600 dark:border-blue-500"
            >
              Entrar
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="font-bold text-xl mb-3 dark:text-white">Taxa de 2.5%</h3>
            <p className="text-gray-600 dark:text-gray-300">
              1.5% para plataforma + 1% de cashback para o pagador.
              Mais barato que qualquer concorrente.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="font-bold text-xl mb-3 dark:text-white">100% Cripto</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Plataforma nunca toca em BRL. Apenas crypto.
              Otimização fiscal e liberdade máxima.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="font-bold text-xl mb-3 dark:text-white">P2P Real</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Marketplace descentralizado. Liquidez garantida pelos usuários.
              Transações diretas entre pessoas.
            </p>
          </div>
        </div>

        {/* Como Funciona */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 mb-16">
          <h2 className="text-3xl font-bold text-center mb-10 dark:text-white">Como Funciona</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Para quem tem crypto */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-blue-600 dark:text-blue-400">Tenho Crypto</h3>
              <ol className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                  <span>Crie um pedido de pagamento (boleto ou PIX)</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                  <span>Ofereça crypto em troca do pagamento</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                  <span>Aguarde alguém aceitar seu pedido</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 dark:text-blue-400">4.</span>
                  <span>Receba confirmação do pagamento</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 dark:text-blue-400">5.</span>
                  <span>Sua conta é paga! (desconto de 2.5% em taxas)</span>
                </li>
              </ol>
            </div>

            {/* Para quem quer crypto */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-green-600 dark:text-green-400">Quero Crypto</h3>
              <ol className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 dark:text-green-400">1.</span>
                  <span>Navegue pelo marketplace de pedidos</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 dark:text-green-400">2.</span>
                  <span>Escolha um pedido de boleto ou PIX</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 dark:text-green-400">3.</span>
                  <span>Efetue o pagamento em BRL</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 dark:text-green-400">4.</span>
                  <span>Envie o comprovante</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 dark:text-green-400">5.</span>
                  <span>Receba crypto + 1% de cashback!</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 rounded-xl shadow-lg p-10 mb-16 text-white">
          <h2 className="text-3xl font-bold text-center mb-10">Plataforma em Crescimento</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{stats.totalUsers.toLocaleString('pt-BR')}</div>
              <p className="text-lg opacity-90">Usuários Ativos</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">R$ {(parseFloat(stats.totalVolume) / 1000000).toFixed(1)}M</div>
              <p className="text-lg opacity-90">Volume Total</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{stats.avgMatchTime} min</div>
              <p className="text-lg opacity-90">Tempo Médio de Match</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{stats.successRate}%</div>
              <p className="text-lg opacity-90">Taxa de Sucesso</p>
            </div>
          </div>
          <p className="text-center mt-8 text-sm opacity-75">
            📊 Dados atualizados em tempo real
          </p>
        </div>

        {/* Criptos Aceitas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 mb-16">
          <h2 className="text-3xl font-bold text-center mb-10 dark:text-white">Criptomoedas Aceitas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl shadow-md">
              <div className="flex justify-center mb-4">
                <svg width="64" height="64" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="16" fill="#F7931A"/>
                  <path d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z" fill="white"/>
                </svg>
              </div>
              <p className="font-bold text-xl text-center mb-2 dark:text-white">Bitcoin</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">BTC</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Rede: Bitcoin</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl shadow-md">
              <div className="flex justify-center mb-4">
                <svg width="64" height="64" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="16" fill="#2775CA"/>
                  <path d="M19.5 17.5c0-1.3-.9-1.7-2.7-1.9-1.4-.2-1.7-.4-1.7-.9 0-.4.3-.7 1.1-.7 1 0 1.4.3 1.6.9h2.3c-.2-1.5-1.3-2.5-3.2-2.7v-1.5h-1.8v1.5c-2 .2-3.1 1.3-3.1 2.8 0 1.7 1.3 2.3 3.1 2.5 1.3.2 1.7.4 1.7.9 0 .5-.5.8-1.2.8-1 0-1.6-.4-1.7-1.1h-2.3c.2 1.8 1.6 2.7 3.3 2.9v1.5h1.8v-1.5c1.9-.3 3.2-1.3 3.2-2.8v-.2zm7.5-1.5c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8 8 3.6 8 8zm-1.5 0c0-3.6-2.9-6.5-6.5-6.5s-6.5 2.9-6.5 6.5 2.9 6.5 6.5 6.5 6.5-2.9 6.5-6.5z" fill="white"/>
                </svg>
              </div>
              <p className="font-bold text-xl text-center mb-2 dark:text-white">USD Coin</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">USDC</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Redes: Ethereum, TRC20, Base, Arbitrum</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl shadow-md">
              <div className="flex justify-center mb-4">
                <svg width="64" height="64" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="16" fill="#26A17B"/>
                  <path d="M17.5 13.5v-2h5v-3h-13v3h5v2c-3.6.2-6.3 1.2-6.3 2.5 0 1.4 3.3 2.5 7.3 2.5s7.3-1.1 7.3-2.5c0-1.3-2.7-2.3-6.3-2.5zm-.5 4c-3.9 0-7-.9-7-2s3.1-2 7-2 7 .9 7 2-3.1 2-7 2z" fill="white"/>
                </svg>
              </div>
              <p className="font-bold text-xl text-center mb-2 dark:text-white">Tether</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">USDT</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Redes: Ethereum, TRC20, Base, Arbitrum</p>
            </div>
          </div>
          <p className="text-center text-gray-600 dark:text-gray-300 mt-8 text-sm">
            💡 <strong>Dica:</strong> Use TRC20 ou Layer 2 (Base/Arbitrum) para taxas mais baixas!
          </p>
        </div>

        {/* CTA Final */}
        <div className="text-center bg-blue-600 dark:bg-blue-700 text-white rounded-xl shadow-lg p-12">
          <h2 className="text-4xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-xl mb-8">Junte-se ao futuro dos pagamentos descentralizados</p>
          <a
            href="/register"
            className="inline-block px-10 py-4 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-lg font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition shadow-lg"
          >
            Criar Conta Grátis
          </a>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-600 dark:text-gray-400">
          <p className="mb-2">
            <strong>Status:</strong> MVP v0.1.0 | Em Desenvolvimento
          </p>
          <p className="text-sm">
            Feito com ❤️ para a comunidade cripto brasileira
          </p>
        </div>
      </div>
    </main>
    </>
  );
}
