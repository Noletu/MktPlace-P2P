# Checklist de Testes - v4.1.3

**Branch:** `feature/coupon-system-v4.1.3`
**Desenvolvedor:** Lucas
**Data:** 17/01/2026

---

## URLs de Acesso

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |
| Cupons Admin | http://localhost:3000/admin/coupons |
| Audit Log | http://localhost:3000/admin/audit |
| API | http://localhost:3001 |

---

## 1. Sistema de Cupons (Prioridade Alta)

### 1.1 Admin - CRUD de Cupons (`/admin/coupons`)

- [ ] **Acessar página de cupons** - Menu lateral > Cupons
- [ ] **Criar cupom PÚBLICO**
  - Código: `TESTE50`
  - Desconto: 50%
  - Limite por usuário: 3
  - Marcar como "Público"
  - Verificar se aparece na lista
- [ ] **Criar cupom SECRETO**
  - Código: `SECRETVIP`
  - Desconto: 100%
  - Limite por usuário: 1
  - NÃO marcar como "Público"
- [ ] **Criar cupom com data de expiração**
  - Definir expiração para amanhã
  - Verificar se mostra data/hora correta
- [ ] **Criar cupom ILIMITADO**
  - Marcar checkbox "Ilimitado"
  - Verificar se exibe "Ilimitado" na tabela
- [ ] **Editar cupom existente**
  - Alterar desconto
  - Alterar limite de uso
  - Verificar que código NÃO pode ser editado
- [ ] **Desativar cupom**
  - Toggle de status para inativo
  - Verificar que não aparece mais para usuários
- [ ] **Deletar cupom**
  - Confirmar exclusão
  - Verificar remoção da lista
- [ ] **Filtros funcionando**
  - Buscar por código
  - Filtrar por status (Ativo/Inativo/Expirado)
  - Filtrar por visibilidade (Público/Secreto)
- [ ] **Estatísticas visíveis**
  - Total de cupons
  - Cupons ativos
  - Total de usos

### 1.2 Usuário - Ativação de Cupons (`/profile`)

- [ ] **Visualizar cupons públicos**
  - Acessar perfil como usuário comum
  - Ver lista de cupons disponíveis
- [ ] **Ativar cupom público clicando**
  - Clicar no botão "Ativar" do cupom público
  - Verificar destaque verde no cupom ativo
- [ ] **Ativar cupom SECRETO por código**
  - Digitar código `SECRETVIP` manualmente
  - Confirmar ativação
- [ ] **Apenas 1 cupom ativo por vez**
  - Tentar ativar segundo cupom
  - Verificar que desativa o anterior
- [ ] **Desativar cupom**
  - Clicar em desativar
  - Verificar que cupom não está mais ativo
- [ ] **Cupom expirado não pode ser ativado**
  - Criar cupom com expiração passada (via admin)
  - Tentar ativar como usuário
  - Deve falhar

### 1.3 Usuário - Uso do Cupom ao Criar Pedido (`/orders/create`)

- [ ] **Banner do cupom ativo aparece**
  - Com cupom ativo, acessar criação de pedido
  - Ver banner com código e % de desconto
- [ ] **Comparação de taxas exibida**
  - Taxa original (1.5%) riscada
  - Taxa com desconto calculada
  - Valor da economia em crypto
- [ ] **Desconto aplicado corretamente**
  - Cupom 50% -> Taxa 0.75%
  - Cupom 100% -> Taxa 0%
  - Cashback (1%) sempre inalterado
- [ ] **Pedido criado com desconto registrado**
  - Verificar campos `appliedCouponCode` e `discountAmount`
- [ ] **Contador de uso incrementado**
  - Após criar pedido, verificar se uso foi contado
  - No perfil, ver "Usado X de Y vezes"
- [ ] **Limite de uso respeitado**
  - Usar cupom até atingir limite
  - Verificar que não pode mais usar

---

## 2. Segurança - Contas Bloqueadas (Prioridade Alta)

### 2.1 Admin - Bloquear Usuário

- [ ] **Bloquear usuário temporariamente**
  - Acessar gestão de usuários
  - Selecionar usuário
  - Definir motivo e data de expiração
  - Confirmar bloqueio
- [ ] **Bloquear usuário permanentemente**
  - Bloquear sem data de expiração
  - Verificar que fica como "Permanente"

### 2.2 Usuário Bloqueado - Restrições

- [ ] **Banner vermelho no frontend**
  - Logar como usuário bloqueado
  - Ver banner de conta suspensa
  - Mensagem com motivo e data (se temporário)
- [ ] **NÃO pode criar pedidos**
  - Acessar `/orders/create`
  - Botão de criar desabilitado
  - Tentar via API deve falhar
- [ ] **NÃO pode aceitar pedidos no marketplace**
  - Tentar dar match em pedido existente
  - Deve ser bloqueado
- [ ] **Desbloqueio automático funciona**
  - Bloquear com expiração em 1 minuto
  - Aguardar expiração
  - Verificar desbloqueio automático

---

## 3. Permissões GERENTE e Audit Log (Prioridade Média)

### 3.1 Hierarquia de Roles

Hierarquia: `MASTER (100) > ADMIN (80) > GERENTE (60) > SUPPORT (40) > USER (0)`

- [ ] **GERENTE pode acessar**
  - Disputas (visualizar e resolver)
  - Analytics
  - KYC (aprovar/rejeitar)
- [ ] **GERENTE NÃO pode acessar**
  - Platform Wallets
  - Mudança de roles
  - Master Seed
- [ ] **ADMIN pode fazer tudo que GERENTE faz + mais**
- [ ] **MASTER tem acesso total**

### 3.2 Audit Log (`/admin/audit`)

- [ ] **Logs sendo registrados**
  - Fazer login/logout
  - Criar/editar cupom
  - Bloquear usuário
  - Verificar se aparecem nos logs
- [ ] **Filtros funcionando**
  - Filtrar por usuário
  - Filtrar por ação
  - Filtrar por data
  - Filtrar por sucesso/falha
- [ ] **Mudança de role registrada**
  - Mudar role de um usuário
  - Verificar `USER_ROLE_CHANGE` no log
  - Ver email e role do admin que fez a ação

---

## 4. Outras Funcionalidades Incluídas

### 4.1 Tema Claro/Escuro (Admin)

- [ ] **Toggle de tema funciona**
  - Verificar botão de alternância
  - Tema persiste após refresh

### 4.2 Crypto Price Cards

- [ ] **Cards exibindo preços**
  - Ver preços de BTC, ETH, etc.
  - Taxas em tempo real

### 4.3 Menu Admin com Ícones

- [ ] **Ícones centralizados**
  - Verificar alinhamento visual

---

## 5. Testes de Regressão (Verificar que não quebrou)

- [ ] **Login/Logout funcionando**
- [ ] **2FA funcionando (se habilitado)**
- [ ] **Criação de pedido SEM cupom funciona**
- [ ] **Match de pedidos funciona**
- [ ] **Chat entre usuários funciona**
- [ ] **Upload de comprovante funciona**
- [ ] **Notificações aparecem**

---

## Credenciais de Teste (do banco dev.db)

> **Nota:** Verifique no banco quais usuários existem. O Lucas pode ter criado usuários de teste.

```bash
# Ver usuários existentes
sqlite3 apps/api/prisma/dev.db "SELECT email, role, accountFrozen FROM User LIMIT 10;"
```

---

## Resultados dos Testes

| Seção | Status | Observações |
|-------|--------|-------------|
| 1.1 Admin CRUD Cupons | ⬜ Pendente | |
| 1.2 Usuário Ativação | ⬜ Pendente | |
| 1.3 Uso em Pedidos | ⬜ Pendente | |
| 2.1 Bloquear Usuário | ⬜ Pendente | |
| 2.2 Restrições Bloqueado | ⬜ Pendente | |
| 3.1 Hierarquia Roles | ⬜ Pendente | |
| 3.2 Audit Log | ⬜ Pendente | |
| 4.x Outras Features | ⬜ Pendente | |
| 5. Regressão | ⬜ Pendente | |

---

**Legenda:** ⬜ Pendente | ✅ Passou | ❌ Falhou | ⚠️ Parcial
