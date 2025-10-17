# Sistema de Disputas v1.0

## 🎯 Visão Geral

Sistema completo de resolução de disputas para transações P2P, permitindo que compradores e vendedores abram disputas quando há problemas no fluxo de pagamento.

## 📋 Quando Abrir Disputa?

### Comprador pode abrir:
- ✅ Após 24h do status `PAYMENT_SENT` sem confirmação do vendedor
- ✅ Pagamento foi enviado mas crypto não foi liberada

### Vendedor pode abrir:
- ✅ Comprovante enviado mas pagamento não recebido
- ✅ Comprovante é falso/editado
- ✅ Valor recebido difere do combinado

## 🔄 Fluxo de Disputa

```
1. Usuário abre disputa → Status: OPEN
   └─ Outra parte tem 24h para responder

2. Outra parte responde → Status: UNDER_REVIEW
   └─ Plataforma tem 48h para resolver

3. Admin analisa e decide → Status: RESOLVED_*
   └─ Ações executadas (refund/release)
   └─ Reputação ajustada
```

## 📡 Endpoints API

### Usuário
- `POST /api/v1/disputes` - Criar disputa
- `POST /api/v1/disputes/:id/respond` - Responder disputa
- `POST /api/v1/disputes/:id/messages` - Adicionar mensagem/evidência
- `GET /api/v1/disputes/:id` - Ver detalhes
- `GET /api/v1/disputes/my-disputes` - Minhas disputas

### Admin
- `GET /api/v1/disputes` - Listar todas
- `GET /api/v1/disputes/stats` - Estatísticas
- `POST /api/v1/disputes/:id/resolve` - Resolver disputa

## 📊 Categorias de Disputa

```typescript
enum DisputeCategory {
  PAYMENT_SENT_NOT_CONFIRMED = "Enviei pagamento mas vendedor não confirma"
  CRYPTO_NOT_RELEASED = "Confirmei pagamento mas crypto não liberada"
  PAYMENT_NOT_RECEIVED = "Comprovante enviado mas não recebi"
  FAKE_RECEIPT = "Comprovante é falso/editado"
  WRONG_AMOUNT = "Valor recebido está errado"
  WRONG_RECIPIENT = "Pagamento para pessoa/chave errada"
  OTHER = "Outro motivo"
}
```

## ⚖️ Tipos de Resolução

```typescript
enum ResolutionType {
  REFUND_BUYER_FULL = "Reembolso total ao comprador"
  REFUND_BUYER_PARTIAL = "Reembolso parcial"
  RELEASE_SELLER = "Liberar crypto para vendedor"
  CANCEL_NO_PENALTY = "Cancelar sem penalidade"
  PENALTY_BUYER = "Penalizar comprador (fraude)"
  PENALTY_SELLER = "Penalizar vendedor (má-fé)"
}
```

## 📈 Sistema de Reputação

| Ação | Ajuste |
|------|--------|
| Ganhar disputa | +10 pontos |
| Perder disputa | -20 pontos |
| Fraude comprovada | -100 pontos |

## ⏱️ Deadlines

- **Responder:** 24h após abertura
- **Resolver:** 48h após resposta (dias úteis)
- **Penalidade:** Não responder = decisão automática a favor da outra parte

## 📎 Evidências Obrigatórias

### Comprador:
- Comprovante de pagamento (PIX/Boleto)
- Extrato bancário (opcional mas recomendado)

### Vendedor:
- Extrato bancário (últimas 48h)
- Print de chave PIX ou boleto fornecido

## 🔐 Segurança

- ✅ Apenas partes envolvidas + admin podem acessar
- ✅ Audit logs de todas ações
- ✅ Validações de permissão em todos endpoints
- ✅ Rate limiting para criação de disputas
- ✅ Validação de campos (min 50 chars para descrição)

## 💬 Thread de Mensagens

- Ambas partes podem adicionar mensagens
- Admin pode pedir esclarecimentos
- Suporta anexos (PDF, JPG, PNG - max 5MB)
- Notificações em tempo real

## 📱 Notificações

- 🚨 Disputa aberta → Outra parte
- 💬 Resposta recebida → Criador
- 🔍 Admin pediu info → Ambos
- ✅ Disputa resolvida → Ambos (com decisão detalhada)

## 🗂️ Arquivos Backend

```
apps/api/src/
├── types/dispute.types.ts          # Tipos e enums
├── services/dispute.service.ts     # Lógica de negócio
├── controllers/dispute.controller.ts # Endpoints REST
└── routes/dispute.routes.ts        # Rotas
```

## 🎨 Frontend (TODO)

- [ ] Formulário de abertura (`/orders/:id/dispute/new`)
- [ ] Página de detalhes (`/disputes/:id`)
- [ ] Thread de mensagens (componente)
- [ ] Painel admin (`/admin/disputes`)
- [ ] Badge de disputas pendentes

## 📚 Exemplo de Uso

### 1. Criar Disputa
```typescript
POST /api/v1/disputes
{
  "orderId": "abc123",
  "category": "PAYMENT_SENT_NOT_CONFIRMED",
  "title": "Enviei PIX mas vendedor não confirma",
  "description": "Enviei o PIX há 26 horas mas o vendedor não confirma recebimento...",
  "attachments": ["https://bucket.com/comprovante-pix.jpg"]
}
```

### 2. Responder
```typescript
POST /api/v1/disputes/:id/respond
{
  "contestation": "Não recebi nenhum pagamento. Segue meu extrato bancário...",
  "counterEvidences": ["https://bucket.com/extrato.pdf"]
}
```

### 3. Resolver (Admin)
```typescript
POST /api/v1/disputes/:id/resolve
{
  "resolutionType": "REFUND_BUYER_FULL",
  "resolution": "Análise: O comprovante é válido e o vendedor não apresentou extrato bancário válido..."
}
```

## 🔮 Melhorias Futuras

- [ ] IA para análise de comprovantes
- [ ] Sistema de acordos (mediação automática)
- [ ] Árbitros externos (descentralização)
- [ ] Estatísticas de disputas por usuário
- [ ] Sistema de apelação
