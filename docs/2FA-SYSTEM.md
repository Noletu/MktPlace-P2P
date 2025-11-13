# Sistema de Autenticação de Dois Fatores (2FA)

## 📋 Visão Geral

O sistema 2FA do Marketplace P2P adiciona uma camada extra de segurança às contas dos usuários, implementando autenticação baseada em TOTP (Time-based One-Time Password) compatível com apps autenticadores como Google Authenticator, Microsoft Authenticator e Authy.

**Data de Implementação:** 2025-11-12
**Versão:** 1.0
**Status:** ✅ Produção

---

## 🎯 Funcionalidades

### Core Features

1. **Ativação de 2FA**
   - Geração de secret TOTP único por usuário
   - QR Code para fácil configuração
   - Validação de token antes de ativar
   - Geração de 10 backup codes hasheados

2. **Login com 2FA**
   - Detecção automática de usuários com 2FA ativo
   - Suporte para tokens TOTP (códigos de 6 dígitos)
   - Suporte para backup codes (one-time use)
   - Integração transparente no fluxo de login

3. **Gerenciamento de Backup Codes**
   - Regeneração de códigos com validação 2FA
   - Contagem de códigos disponíveis
   - Remoção automática após uso
   - Interface para download/cópia

4. **Desativação de 2FA**
   - Requer validação de token para desativar
   - Remoção completa de secret e backup codes
   - Audit logging de todas operações

---

## 🏗️ Arquitetura

### Backend (API)

#### 1. Service Layer
**Arquivo:** `apps/api/src/services/twoFactor.service.ts`

**Métodos:**
```typescript
// Gerar secret e QR Code
generateSecret(userId: string, email: string): Promise<{ secret: string; qrCode: string }>

// Habilitar 2FA
enableTwoFactor(userId: string, token: string): Promise<{ success: boolean; backupCodes: string[] }>

// Desabilitar 2FA
disableTwoFactor(userId: string, token: string): Promise<boolean>

// Verificar token (TOTP ou backup code)
verifyToken(userId: string, token: string): Promise<boolean>

// Regenerar backup codes
regenerateBackupCodes(userId: string, token: string): Promise<{ success: boolean; backupCodes: string[] }>

// Contar backup codes disponíveis
getBackupCodesCount(userId: string): Promise<number>

// Verificar se 2FA está habilitado
isTwoFactorEnabled(userId: string): Promise<boolean>
```

**Segurança:**
- Secret gerado com 32 caracteres
- Backup codes hasheados com bcrypt
- Validação de window TOTP configurável
- Códigos mostrados apenas UMA VEZ

#### 2. Controller Layer
**Arquivo:** `apps/api/src/controllers/twoFactor.controller.ts`

**Endpoints:**
- `GET /api/v1/2fa/status` - Verificar status e contagem de backup codes
- `POST /api/v1/2fa/generate` - Gerar secret e QR Code
- `POST /api/v1/2fa/enable` - Habilitar 2FA
- `POST /api/v1/2fa/disable` - Desabilitar 2FA
- `POST /api/v1/2fa/regenerate-backup-codes` - Regenerar backup codes

**Features de Segurança:**
- Rate limiting em todos endpoints
- Audit logging automático
- Validação de autenticação em todas rotas

#### 3. Routes
**Arquivo:** `apps/api/src/routes/twoFactor.routes.ts`

Todas as rotas:
- Requerem autenticação (`authMiddleware`)
- Possuem rate limiting (`twoFactorLimiter`)
- São prefixadas com `/api/v1/2fa`

#### 4. Database Schema
**Arquivo:** `apps/api/prisma/schema.prisma`

**Campos adicionados ao modelo User:**
```prisma
model User {
  // ... outros campos
  twoFactorEnabled     Boolean?  @default(false)
  twoFactorSecret      String?
  twoFactorBackupCodes String?   // JSON array de hashes bcrypt
}
```

#### 5. Validation Schema
**Arquivo:** `packages/shared/src/validations.ts`

**Campo adicionado ao loginSchema:**
```typescript
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  twoFactorToken: z.string().optional(), // Token 2FA opcional
});
```

### Frontend (Web)

#### 1. Página de Configuração 2FA
**Arquivo:** `apps/web/app/2fa/setup/page.tsx`

**Estados do Fluxo:**
1. `initial` - Status atual (ativo/inativo)
2. `setup` - Exibir QR Code para ativar
3. `backup-codes` - Exibir códigos após ativação
4. `regenerate-prompt` - Solicitar token para regenerar
5. `regenerate-codes` - Exibir novos códigos

**Funcionalidades:**
- Geração e exibição de QR Code
- Input de token com validação
- Exibição de backup codes
- Botões para copiar/baixar códigos
- Checkbox de confirmação
- Ativar/Desativar 2FA
- Regenerar backup codes

#### 2. Integração no Login
**Arquivo:** `apps/web/components/forms/LoginForm.tsx`

**Fluxo:**
1. Usuário envia email + senha
2. Se 2FA ativo, API retorna `requiresTwoFactor: true`
3. Form exibe campo para token 2FA
4. Usuário envia token junto com credenciais
5. API valida e retorna access token

#### 3. Security Banner (Dashboard)
**Arquivo:** `apps/web/components/dashboard/SecurityBanner.tsx`

**Comportamento:**
- Aparece apenas se 2FA estiver INATIVO
- Mostra botão "Ativar 2FA Agora"
- Desaparece automaticamente após ativação
- Também alerta sobre níveis KYC baixos

#### 4. Perfil do Usuário
**Arquivo:** `apps/web/app/profile/page.tsx`

**Seção "Segurança":**
- Status visual (badge verde/laranja)
- Mensagem contextual (ativo/inativo)
- Botão "Ativar 2FA" ou "Gerenciar 2FA"
- Informações educativas sobre 2FA
- Lista de apps recomendados

**Posicionamento:** Logo após "Informações Básicas"

---

## 🔒 Segurança

### Práticas Implementadas

1. **Criptografia de Backup Codes**
   - Codes são hasheados com bcrypt antes de salvar
   - Nunca armazenados em plain text
   - Comparação segura no login

2. **Rate Limiting**
   - Limite de tentativas em endpoints 2FA
   - Previne brute force de tokens
   - Configurado via middleware

3. **Audit Logging**
   - Log de ativação/desativação
   - Log de regeneração de códigos
   - Rastreamento de todas operações críticas

4. **Validação de Token**
   - Window TOTP configurável
   - Suporte para clock drift
   - Timeout automático de tokens

5. **One-Time Use de Backup Codes**
   - Códigos removidos após uso
   - Impossível reutilizar
   - Contagem atualizada em tempo real

6. **Proteção de Endpoints**
   - Autenticação obrigatória
   - Validação de input com Zod
   - Error handling apropriado

---

## 🧪 Testes

### Suite de Testes Automatizados
**Arquivo:** `test-2fa-complete.js`

**Testes Implementados:**

1. ✅ **Teste 1: Ativar 2FA pela primeira vez**
   - Cria usuário de teste
   - Gera secret e QR Code
   - Valida token TOTP
   - Verifica geração de 10 backup codes
   - Confirma status ativo

2. ✅ **Teste 2: Login com TOTP**
   - Tenta login sem 2FA (detecta requiresTwoFactor)
   - Gera token válido do secret
   - Faz login com token
   - Valida access token retornado

3. ✅ **Teste 3: Login com backup code**
   - Usa backup code no login
   - Verifica sucesso do login
   - Confirma remoção do código usado
   - Valida contagem atualizada (9 códigos)

4. ✅ **Teste 4: Regenerar backup codes**
   - Solicita regeneração com token válido
   - Verifica geração de 10 novos códigos
   - Confirma invalidação dos códigos antigos

5. ✅ **Teste 5: Desativar 2FA**
   - Desativa com token válido
   - Verifica remoção de secret e backup codes
   - Confirma login sem 2FA funciona

**Resultado:** 100% de aprovação (5/5 testes)

**Executar testes:**
```bash
cd /home/nicode/MktPlace-P2P
node test-2fa-complete.js
```

---

## 🐛 Bugs Corrigidos

### Bug #1: Campo twoFactorToken removido na validação
**Data:** 2025-11-12

**Problema:**
- Login com 2FA sempre falhava
- Campo `twoFactorToken` era removido pelo Zod
- API nunca recebia o token

**Causa Raiz:**
`loginSchema` não incluía o campo opcional `twoFactorToken`

**Solução:**
Adicionado campo ao schema:
```typescript
twoFactorToken: z.string().optional()
```

**Arquivo:** `packages/shared/src/validations.ts:55`

### Bug #2: Banner 2FA não desaparecia após ativação
**Data:** 2025-11-12

**Problema:**
- Banner continuava mostrando "Ativar 2FA" mesmo depois de ativar
- Campo `has2FA` não estava sendo retornado

**Causa Raiz:**
`getUserById()` não mapeava `twoFactorEnabled` para `has2FA`

**Solução:**
Adicionado mapeamento no retorno:
```typescript
has2FA: user.twoFactorEnabled
```

**Arquivo:** `apps/api/src/services/auth.service.ts:186`

---

## 📱 Apps Autenticadores Compatíveis

### Recomendados

1. **Google Authenticator**
   - iOS: [App Store](https://apps.apple.com/app/google-authenticator/id388497605)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)

2. **Microsoft Authenticator**
   - iOS: [App Store](https://apps.apple.com/app/microsoft-authenticator/id983156458)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=com.azure.authenticator)

3. **Authy**
   - iOS: [App Store](https://apps.apple.com/app/twilio-authy/id494168017)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=com.authy.authy)

### Configuração Manual

Se o QR Code não funcionar, o usuário pode inserir manualmente:
- **Tipo:** Time-based (TOTP)
- **Issuer:** Mktplace da Liberdade
- **Account:** [email do usuário]
- **Secret:** [código fornecido pela aplicação]
- **Período:** 30 segundos
- **Algoritmo:** SHA-1
- **Dígitos:** 6

---

## 🚀 Fluxo de Uso

### Para Usuários Finais

#### Ativando 2FA

1. Acesse **Meu Perfil** ou **Dashboard**
2. Vá para a seção **"Segurança"**
3. Clique em **"Ativar 2FA"**
4. Abra seu app autenticador
5. Escaneie o QR Code exibido
6. Digite o código de 6 dígitos
7. Clique em **"Confirmar e Ativar"**
8. **IMPORTANTE:** Copie e guarde os 10 backup codes em local seguro
9. Marque o checkbox de confirmação
10. Clique em **"Continuar"**

#### Fazendo Login com 2FA

1. Digite email e senha normalmente
2. Sistema detecta 2FA ativo
3. Digite o código do seu app autenticador
4. Ou use um backup code se perdeu acesso ao app
5. Faça login normalmente

#### Regenerando Backup Codes

1. Acesse **Meu Perfil** → **Segurança** → **"Gerenciar 2FA"**
2. Clique em **"Gerar Novos Códigos de Recuperação"**
3. Digite código do app autenticador
4. Copie os novos 10 códigos
5. **ATENÇÃO:** Códigos antigos são invalidados

#### Desativando 2FA

1. Acesse **Meu Perfil** → **Segurança** → **"Gerenciar 2FA"**
2. Role até **"Desativar 2FA"**
3. Digite código do app autenticador
4. Confirme a desativação

---

## 💻 Para Desenvolvedores

### Variáveis de Ambiente

```env
# Nome exibido nos apps autenticadores
TWO_FACTOR_ISSUER=Mktplace da Liberdade

# Window de validação TOTP (tolerância clock drift)
TWO_FACTOR_WINDOW=1
```

### Dependências

```json
{
  "speakeasy": "^2.0.0",  // Geração TOTP
  "qrcode": "^1.5.0"      // Geração QR Code
}
```

### Estrutura de Pastas

```
apps/api/
├── src/
│   ├── services/
│   │   └── twoFactor.service.ts      # Lógica de negócio
│   ├── controllers/
│   │   └── twoFactor.controller.ts   # Handlers HTTP
│   └── routes/
│       └── twoFactor.routes.ts       # Definição de rotas
│
apps/web/
├── app/
│   ├── 2fa/
│   │   └── setup/
│   │       └── page.tsx              # Página de configuração
│   ├── profile/
│   │   └── page.tsx                  # Seção segurança no perfil
│   └── dashboard/
│       └── page.tsx                  # Dashboard com banner
│
└── components/
    ├── forms/
    │   └── LoginForm.tsx             # Login com 2FA
    └── dashboard/
        └── SecurityBanner.tsx        # Banner de alertas
```

### Extensões Futuras Possíveis

1. **SMS 2FA**
   - Alternativa ao TOTP
   - Integração com Twilio/SNS

2. **WebAuthn/FIDO2**
   - Suporte para chaves de segurança física
   - Biometria

3. **Recovery Codes via Email**
   - Envio de código temporário
   - Útil se perder acesso total

4. **Trusted Devices**
   - Lembrar dispositivos por 30 dias
   - Reduzir fricção para usuários frequentes

5. **2FA Obrigatório para Admins**
   - Política de segurança
   - Enforcement automático

---

## 📊 Métricas de Sucesso

### Cobertura de Testes
- ✅ 100% dos fluxos principais testados
- ✅ 5/5 testes automatizados passando
- ✅ Testes de segurança incluídos

### Segurança
- ✅ Backup codes hasheados
- ✅ Rate limiting implementado
- ✅ Audit logging completo
- ✅ Validação de input robusta

### UX
- ✅ Banner contextual no dashboard
- ✅ Seção dedicada no perfil
- ✅ Página de configuração completa
- ✅ Integração transparente no login

---

## 📝 Notas de Versão

### v1.0 (2025-11-12)

**Funcionalidades:**
- ✅ Sistema 2FA completo com TOTP
- ✅ Backup codes com hash bcrypt
- ✅ Regeneração de códigos
- ✅ UI completa para gerenciamento
- ✅ Integração no login
- ✅ Banner e alertas contextuais

**Melhorias de UX:**
- ✅ Seção "Segurança" no perfil
- ✅ Banner aparece apenas quando necessário
- ✅ Reorganização do dashboard
- ✅ Status visual claro (badges)

**Bugs Corrigidos:**
- ✅ Campo twoFactorToken no loginSchema
- ✅ Mapeamento has2FA no getUserById
- ✅ Posicionamento de elementos na UI

**Testes:**
- ✅ Suite completa de testes automatizados
- ✅ 100% de aprovação

---

## 🆘 Troubleshooting

### Problema: Token sempre inválido

**Possíveis causas:**
1. Clock do servidor dessincronizado
2. Clock do dispositivo dessincronizado
3. Window TOTP muito restrito

**Soluções:**
1. Sincronizar relógio do servidor: `ntpdate -u pool.ntp.org`
2. Verificar timezone do servidor
3. Aumentar `TWO_FACTOR_WINDOW` no .env

### Problema: QR Code não funciona

**Soluções:**
1. Usar entrada manual do secret
2. Verificar se app autenticador está atualizado
3. Tentar outro app autenticador

### Problema: Perdi acesso ao app e aos backup codes

**Solução:**
1. Contatar suporte
2. Verificação de identidade manual
3. Desativação forçada de 2FA por admin

---

## 👥 Equipe

**Desenvolvido por:** Claude + Nicolas Koutroularis
**Data:** Novembro 2025
**Versão:** 1.0

---

## 📚 Referências

- [RFC 6238 - TOTP](https://tools.ietf.org/html/rfc6238)
- [OWASP 2FA Guide](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [Speakeasy Documentation](https://www.npmjs.com/package/speakeasy)
- [QRCode Documentation](https://www.npmjs.com/package/qrcode)

---

**Última atualização:** 2025-11-12
