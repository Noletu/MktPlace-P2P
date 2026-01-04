#!/bin/bash

# Script de commit para Feature: Crypto Price Cards
# Data: 04/01/2026
# Versão: 1.0.0

echo "=========================================="
echo "  Crypto Price Cards - Git Commit"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se estamos em um repositório git
if [ ! -d .git ]; then
    echo -e "${YELLOW}⚠️  Não é um repositório git. Inicializando...${NC}"
    git init
    echo -e "${GREEN}✅ Repositório git inicializado${NC}"
fi

echo -e "${BLUE}📝 Adicionando arquivos novos...${NC}"
echo ""

# Arquivos criados
echo "Novos arquivos:"
git add apps/web/services/cryptoPriceService.ts
echo "  ✅ apps/web/services/cryptoPriceService.ts"

git add apps/web/hooks/useCryptoPrices.ts
echo "  ✅ apps/web/hooks/useCryptoPrices.ts"

git add apps/web/components/CryptoPriceCard.tsx
echo "  ✅ apps/web/components/CryptoPriceCard.tsx"

git add apps/web/components/CryptoPriceCards.tsx
echo "  ✅ apps/web/components/CryptoPriceCards.tsx"

git add docs/CRYPTO-PRICE-CARDS.md
echo "  ✅ docs/CRYPTO-PRICE-CARDS.md"

git add CHANGELOG-CRYPTO-CARDS.md
echo "  ✅ CHANGELOG-CRYPTO-CARDS.md"

echo ""
echo -e "${BLUE}📝 Adicionando arquivos modificados...${NC}"
echo ""

# Arquivos modificados
echo "Arquivos modificados:"
git add apps/web/app/admin/page.tsx
echo "  ✅ apps/web/app/admin/page.tsx"

git add apps/web/components/AppHeader.tsx
echo "  ✅ apps/web/components/AppHeader.tsx"

git add apps/web/app/admin/layout.tsx
echo "  ✅ apps/web/app/admin/layout.tsx"

git add apps/web/app/globals.css
echo "  ✅ apps/web/app/globals.css"

echo ""
echo -e "${BLUE}📊 Status do git:${NC}"
git status --short

echo ""
echo -e "${YELLOW}📋 Criando commit...${NC}"

# Mensagem de commit detalhada
git commit -m "feat: Implementar Crypto Price Cards com preços e taxas em tempo real

✨ Novos Recursos:
- Sistema de exibição de preços BTC, SOL, ETH
- Taxas de rede estimadas para cada blockchain
- Auto-atualização: preços (30min) e taxas (15min)
- Design responsivo: cards (desktop) / dropdown (mobile)
- Tooltips informativos com detalhes por crypto
- Cores temáticas: BTC (laranja), SOL (roxo), ETH (azul)

📁 Arquivos Criados:
- apps/web/services/cryptoPriceService.ts (285 linhas)
  * Integração com APIs (CoinGecko, mempool.space, Etherscan)
  * Cálculos de taxas de rede
  * Formatação de valores

- apps/web/hooks/useCryptoPrices.ts (115 linhas)
  * Hook customizado para gerenciar estado
  * Auto-atualização com intervals
  * Refresh manual disponível

- apps/web/components/CryptoPriceCard.tsx (238 linhas)
  * Card individual para cada crypto
  * Layout horizontal compacto
  * Tooltips com detalhes (BTC: 3 faixas)

- apps/web/components/CryptoPriceCards.tsx (185 linhas)
  * Container responsivo
  * Desktop: 3 cards / Mobile: dropdown

- docs/CRYPTO-PRICE-CARDS.md
  * Documentação completa da feature
  * Arquitetura, APIs, troubleshooting

- CHANGELOG-CRYPTO-CARDS.md
  * Registro detalhado de mudanças

🔧 Arquivos Modificados:
- apps/web/app/admin/page.tsx
  * Removido cards duplicados (Carteiras e Disputas)

- apps/web/components/AppHeader.tsx
  * Integrado CryptoPriceCards
  * Layout mudado para grid 3 colunas
  * Cards centralizados
  * Removido botão admin duplicado

- apps/web/app/admin/layout.tsx
  * Integrado CryptoPriceCards
  * Layout mudado para grid 3 colunas
  * Badge dinâmico: MASTER (roxo) / ADMIN (azul)

- apps/web/app/globals.css
  * Adicionada animação fadeIn para tooltips

🌐 APIs Integradas:
- CoinGecko: Preços de BTC, SOL, ETH
- mempool.space: Taxas Bitcoin (sat/vB)
- Etherscan: Gas Ethereum (Gwei)
- Solana: Cálculo fixo (5000 lamports)

🎨 Design:
- Layout horizontal compacto (~50px altura)
- Cores temáticas por crypto
- Suporte dark mode
- Tooltips com animação fadeIn
- Centralizado no header

⚡ Performance:
- Auto-atualização otimizada
- Cleanup de intervals
- Lazy loading
- Cache em estado

📱 Responsivo:
- Desktop (≥1280px): 3 cards lado a lado
- Mobile (<1280px): Dropdown button

🔒 Taxas Estimadas:
- BTC: Transação ~140 vBytes
- SOL: 5000 lamports
- ETH L1: 21000 gas
- ETH L2 (Base): ~1% do custo L1

🚀 Status: Production Ready

Co-authored-by: nicode <nicode@mktplace-p2p>
"

echo ""
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Commit criado com sucesso!${NC}"
    echo ""
    echo -e "${BLUE}📊 Resumo do commit:${NC}"
    git log -1 --stat
    echo ""
    echo -e "${GREEN}=========================================="
    echo "  ✅ Crypto Price Cards commitado!"
    echo "==========================================${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. git push origin main (ou sua branch)"
    echo "  2. Criar Pull Request se necessário"
    echo "  3. Deploy para staging/produção"
else
    echo -e "${YELLOW}⚠️  Erro ao criar commit${NC}"
    exit 1
fi
