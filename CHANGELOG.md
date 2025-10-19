# Changelog - Mktplace da Liberdade

## [0.2.0] - 2025-01-19

### 🎨 Nova Interface Admin Completa (Dark Theme)

#### Painel Administrativo Redesenhado
- **Dashboard Admin** completamente reformulado com tema escuro profissional
- Paleta de cores unificada: `bg-gray-900` (fundo), `bg-gray-800` (cards), bordas `border-gray-700`
- Gradiente no header: `from-gray-800 to-gray-900`
- Navegação com tabs interativas e highlight azul para página ativa

#### Componentes Reutilizáveis Criados
1. **StatCard** - Cards de estatísticas com ícone, valor, mudança percentual
2. **StatusBadge** - Badges coloridos com variantes (default, success, warning, danger, info)
3. **ChartCard** - Wrapper para gráficos com loading state
4. **UserAvatar** - Avatar com iniciais ou imagem, cores por hash
5. **DataTable** - Tabela genérica configurável
6. **FilterBar & FilterField** - Container para filtros consistentes
7. **ExportButton** - Botão de exportação com loading

#### Gráficos (Recharts)
1. **OrdersStatusChart** - Gráfico de pizza com distribuição de status
2. **VolumeChart** - Gráfico de área mostrando volume por dia

#### Páginas Admin Completas
- **Dashboard** - Estatísticas gerais + gráficos + widgets
- **Usuários** - Gestão completa com filtros e tabela
- **Pedidos** - Controle de pedidos com filtros por status/tipo
- **Audit Log** - Log de auditoria com filtros
- **Endereços** - Gestão de wallets da plataforma
- **Profile Admin** - Perfil do administrador

### ⚖️ Sistema de Disputas Completo

#### Backend (API)
- Novos endpoints: criar, listar, detalhar, mensagens, evidências, resolver, escalar
- Service layer completo com lógica de negócio
- Notificações automáticas
- Paginação e filtros

#### Frontend
- Página de disputas do usuário
- Página de detalhes com thread de mensagens
- Painel admin de disputas com estatísticas
- Upload de evidências
- Ações admin: resolver, escalar

#### Database Schema
- Model Dispute, DisputeMessage, DisputeEvidence
- Relações com Order, User, Admin

### 🔐 Melhorias de Autenticação e UX

#### Redirecionamento Inteligente
- Admins → `/admin` (direto para painel)
- Usuários → `/dashboard`

#### Navegação Admin Expandida
- Nova aba: **🛒 Marketplace**
- Nova aba: **➕ Criar Pedido**

### 🐛 Correções de Bugs
- Dashboard statistics API (aggregate em String)
- Disputes filter bug (data.data.disputes)
- Route ordering (/stats antes de /:id)
- Chart components (loading states e verificações)

### 📦 Dependências
- recharts ^2.10.3
- date-fns ^3.0.6
- react-hot-toast ^2.4.1

---

**Versão**: 0.2.0 | **Data**: 19/01/2025
