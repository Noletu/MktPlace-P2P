export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Mktplace da Liberdade
          </h1>
          <p className="text-2xl text-gray-700 mb-4">
            Pague contas com cripto. Ganhe cripto pagando contas.
          </p>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            O primeiro marketplace P2P brasileiro que conecta quem tem criptomoedas com quem quer criptomoedas.
            Zero contato com BRL pela plataforma. 100% descentralizado.
          </p>

          <div className="mt-10 flex gap-4 justify-center">
            <a
              href="/register"
              className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg"
            >
              Começar Agora
            </a>
            <a
              href="/login"
              className="px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-gray-50 transition shadow-lg border-2 border-blue-600"
            >
              Entrar
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="font-bold text-xl mb-3">Taxa de 2.5%</h3>
            <p className="text-gray-600">
              1.5% para plataforma + 1% de cashback para o pagador.
              Mais barato que qualquer concorrente.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="font-bold text-xl mb-3">100% Cripto</h3>
            <p className="text-gray-600">
              Plataforma nunca toca em BRL. Apenas crypto.
              Otimização fiscal e liberdade máxima.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="font-bold text-xl mb-3">P2P Real</h3>
            <p className="text-gray-600">
              Marketplace descentralizado. Liquidez garantida pelos usuários.
              Transações diretas entre pessoas.
            </p>
          </div>
        </div>

        {/* Como Funciona */}
        <div className="bg-white rounded-xl shadow-lg p-10 mb-16">
          <h2 className="text-3xl font-bold text-center mb-10">Como Funciona</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Para quem tem crypto */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-blue-600">Tenho Crypto</h3>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Crie um pedido de pagamento (boleto ou PIX)</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Ofereça crypto em troca do pagamento</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Aguarde alguém aceitar seu pedido</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">4.</span>
                  <span>Receba confirmação do pagamento</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">5.</span>
                  <span>Sua conta é paga! (desconto de 2.5% em taxas)</span>
                </li>
              </ol>
            </div>

            {/* Para quem quer crypto */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-green-600">Quero Crypto</h3>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="font-bold text-green-600">1.</span>
                  <span>Navegue pelo marketplace de pedidos</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600">2.</span>
                  <span>Escolha um pedido de boleto ou PIX</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600">3.</span>
                  <span>Efetue o pagamento em BRL</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600">4.</span>
                  <span>Envie o comprovante</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600">5.</span>
                  <span>Receba crypto + 1% de cashback!</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Criptos Aceitas */}
        <div className="bg-white rounded-xl shadow-lg p-10 mb-16">
          <h2 className="text-3xl font-bold text-center mb-10">Criptomoedas Aceitas</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
            <div className="p-4">
              <div className="text-3xl mb-2">₿</div>
              <p className="font-bold">Bitcoin</p>
              <p className="text-sm text-gray-600">BTC</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">Ξ</div>
              <p className="font-bold">Ethereum</p>
              <p className="text-sm text-gray-600">ETH</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">🔒</div>
              <p className="font-bold">Monero</p>
              <p className="text-sm text-gray-600">XMR</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">🛡️</div>
              <p className="font-bold">Zcash</p>
              <p className="text-sm text-gray-600">ZEC</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">💵</div>
              <p className="font-bold">USDC</p>
              <p className="text-sm text-gray-600">Stablecoin</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">💰</div>
              <p className="font-bold">USDT</p>
              <p className="text-sm text-gray-600">Tether</p>
            </div>
          </div>
          <p className="text-center text-gray-600 mt-6">
            Suporte para múltiplas redes: Solana, Polygon, BSC, TRC20, e mais!
          </p>
        </div>

        {/* CTA Final */}
        <div className="text-center bg-blue-600 text-white rounded-xl shadow-lg p-12">
          <h2 className="text-4xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-xl mb-8">Junte-se ao futuro dos pagamentos descentralizados</p>
          <a
            href="/register"
            className="inline-block px-10 py-4 bg-white text-blue-600 text-lg font-bold rounded-lg hover:bg-gray-100 transition shadow-lg"
          >
            Criar Conta Grátis
          </a>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-600">
          <p className="mb-2">
            <strong>Status:</strong> MVP v0.1.0 | Em Desenvolvimento
          </p>
          <p className="text-sm">
            Feito com ❤️ para a comunidade cripto brasileira
          </p>
        </div>
      </div>
    </main>
  );
}
