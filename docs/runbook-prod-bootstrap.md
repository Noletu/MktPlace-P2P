# Runbook: Bootstrap de Masters em Produção

> **Status:** Documentação — código de suporte ainda não implementado (veja [Pré-requisitos de código](#pré-requisitos-de-código-ainda-não-implementados)).
> **Última atualização:** 2026-05-15
> **Owners:** Sócio A, Sócio B
> **Referências:** TECH-DEBT-OP02 · SER-15 (mitigação parcial via commits `17fea25` + `0e4f5eb`) · CRIT-08

---

## Objetivo

Este runbook descreve **como criar os dois usuários master da plataforma em produção, pela primeira vez**, sem nunca usar o `prisma seed` (que contém credenciais hardcoded e é bloqueado por guard `NODE_ENV=production`).

O resultado final esperado:

- **Exatamente dois** usuários com role `master` no banco — cada um sob controle de um sócio diferente.
- **Nenhum** usuário `master@mktplace.com` ou `admin@mktplace.com` (defaults do seed) presente.
- **2FA habilitado** em ambos os masters antes que eles possam exercer qualquer permissão crítica.
- **Audit log** registrando criação dos dois, deleção dos defaults (se existirem), troca de senha e ativação de 2FA — para evidência em auditorias futuras.

Este procedimento acontece **uma única vez na vida do produto**. Se for executado novamente em prod, algo deu muito errado (provavelmente recuperação de desastre — veja [Plano de recuperação](#plano-de-recuperação-em-desastre)).

---

## Princípios de segurança

Cada decisão deste runbook protege um ataque ou erro específico. Não pular passos.

### 1. Sem usuário master padrão em produção

**Mitiga:** CRIT-08 (credenciais públicas no repo) + SER-15 (senhas hardcoded).

O `prisma/seed.ts` cria `master@mktplace.com` com senha `Master@2025!` — credenciais conhecidas por qualquer pessoa que clonou o repo. Em prod, isto é um backdoor. Por isso o seed tem guard `NODE_ENV=production` que lança erro imediato (commit `17fea25` em PR #3).

### 2. Dois masters independentes (anti-SPOF)

**Mitiga:** perda total de acesso administrativo se um sócio sumir, perder o celular, ou for incapacitado.

Single Point of Failure de chave é inaceitável em sistema financeiro. Cada sócio tem master próprio, com 2FA próprio, em dispositivos próprios. Operações destrutivas podem (em sprint futura) exigir aprovação dos dois.

### 3. 2FA obrigatório antes de qualquer permissão ativa

**Mitiga:** janela de tempo entre "usuário criado" e "2FA configurado" em que a conta master só tem senha — vetor mais comum de tomada de conta.

A flag `force2FASetup` (campo a ser adicionado ao schema do User — veja [Pré-requisitos de código](#pré-requisitos-de-código-ainda-não-implementados)) força o middleware a redirecionar TODA requisição autenticada para `/auth/setup-2fa` enquanto o usuário não habilitar 2FA. As permissões master só ficam ativas DEPOIS.

### 4. `forcePasswordReset` + `force2FASetup` desde a criação

**Mitiga:** sócio receber senha temporária por canal qualquer (mesmo seguro) e nunca trocar.

O script de bootstrap cria os dois usuários **já marcados** com essas flags. Ao primeiro login, o app obriga: (1) trocar senha; (2) habilitar 2FA. Sem caminho de bypass.

### 5. Atomicidade da transação (INSERT sócios + DELETE defaults em mesma TX)

**Mitiga:** estado intermediário inseguro — ambiente com sócios E defaults coexistindo, ou pior, sem masters após DELETE mas antes do INSERT.

O bootstrap roda **uma única transação SQL** com todas as escritas. Ou tudo acontece, ou nada acontece. Não existe meio-termo.

---

## Pré-requisitos (checklist)

Antes de começar, confirmar **todos** os itens. Se algum estiver pendente, parar e resolver primeiro.

- [ ] Servidor de produção provisionado (VPS / cloud instance escolhida)
- [ ] Banco Postgres gerenciado configurado (RDS, Cloud SQL, Supabase, etc.)
- [ ] KMS configurado para master seed (CRIT-10) — verificado em ambiente real
- [ ] Migration `init_postgres_decimal_fields` aplicada (`npx prisma migrate deploy`)
- [ ] RBAC seed executado em prod (`npx tsx prisma/seeds/rbac-seed.ts`) — neste momento o guard `NODE_ENV=production` AINDA NÃO bloqueia o RBAC seed se ele for promovido a "migration controlada"; por enquanto, este passo é executado uma vez antes de ativarmos o guard em prod. Veja TECH-DEBT-DEV01.
- [ ] App rodando mas **isolado** — firewall / IP whitelist / VPN. Nenhum usuário público consegue acessar.
- [ ] Ambos os sócios disponíveis na mesma videochamada (Meet/Zoom/Whereby), com vídeo ligado, durante todo o procedimento
- [ ] Ambos os sócios com gerenciador de senha pessoal (Bitwarden, 1Password) instalado e desbloqueado
- [ ] Ambos os sócios com app authenticator no celular (Authy, Google Authenticator, 1Password)
- [ ] **Cofre físico** definido para guardar backup codes em papel — pode ser cofre da casa, cofre de aluguel em banco, ou caderno em local seguro. Decidido antes, não improvisar.
- [ ] Documento (fora do repo) preparado para registrar: data/hora do bootstrap, email de cada sócio, quem é fallback de quem, localização do cofre dos backup codes

---

## Passo a passo

Cada passo abaixo tem 5 campos:

- **O que acontece:** explicação em linguagem humana.
- **Comando:** o que digitar / clicar. Quem não programa pode copiar e colar.
- **Saída esperada:** o que deve aparecer na tela.
- **Se der erro:** o que fazer.
- **Quem executa:** Sócio A, Sócio B, ou Ambos (cada um na própria máquina).

> ⚠️ Em qualquer ponto, se algo divergir do esperado, **parar** e investigar antes de continuar. Não há pressa para colocar prod no ar; há pressa para não criar conta inválida.

---

### Passo 1 — Gerar senhas temporárias (cada sócio gera a sua)

**O que acontece:** cada sócio gera uma senha aleatória forte na própria máquina. Essa senha será usada **apenas** para o primeiro login. Logo depois, o sistema obriga trocar.

**Comando:**

```bash
openssl rand -base64 32
```

**Saída esperada:** algo como `qC2vK8m+sRtN7L1pXa9YdHfZuQwE3jBgVmK5n4oP=`.

**Se der erro:**
- `command not found: openssl` → No Windows, abrir Git Bash (não cmd nem PowerShell).
- Se realmente não tiver openssl, alternativa: `node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"`.

**Quem executa:** Ambos, **separadamente**. Cada sócio gera a SUA senha temp. Cada um anota a sua no próprio gerenciador (Bitwarden/1Password). **Nunca compartilhar essa senha, nem temporariamente — ela vai virar definitiva no Passo 5.**

---

### Passo 2 — Gerar hash bcrypt da própria senha (sem mandar a senha plain para ninguém)

**O que acontece:** o script de bootstrap precisa do hash bcrypt para inserir no banco. **Nunca digite a senha plain dentro do servidor remoto** — gere o hash localmente e mande apenas o hash. Hash é o que o banco armazena de qualquer jeito; vazar um hash de bcrypt 12-rounds é praticamente inútil para um atacante.

**Comando:** com Node disponível na máquina local:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'sua-senha-temp-do-passo-1'
```

**Saída esperada:** algo como `$2a$12$LRwQ5N0Yt9YJ6vG2KEhc1OFNuHKzCJzv5K8mYBpQqXJwGZdYRb1Vm`.

**Se der erro:**
- `Cannot find module 'bcryptjs'` → executar dentro de `apps/api/` (onde bcryptjs está instalado): `cd apps/api && node -e "..."`. Alternativa: `npx --yes bcryptjs-cli hash 'sua-senha' 12`.
- Hash com tamanho diferente de ~60 chars → algo errado. Não usar.

**Quem executa:** Ambos, **separadamente**. Cada sócio gera o hash da própria senha **localmente**, depois compartilha **apenas o hash** com quem vai operar o script (pode ser por chat criptografado, Signal, ou até voz na chamada — hash é seguro de transmitir).

---

### Passo 3 — Executar `npm run bootstrap-prod`

**O que acontece:** o script `apps/api/scripts/bootstrap-prod.ts` (a ser escrito — veja [Anatomia](#anatomia-do-script-bootstrap-prodts)) é executado **no servidor de produção**, conectado ao banco de produção. Ele:

1. Confirma que `NODE_ENV=production` (anti-acidente em dev).
2. Pede interativamente: email do Sócio A, hash do Sócio A, email do Sócio B, hash do Sócio B.
3. Abre uma transação SQL.
4. INSERT do Sócio A com role master, `forcePasswordReset=true`, `force2FASetup=true`.
5. INSERT do Sócio B com mesmas flags.
6. DELETE dos usuários `master@mktplace.com` e `admin@mktplace.com` se existirem.
7. Verifica que `SELECT COUNT(*) FROM "User" WHERE roleId = <master_role_id>` retorna exatamente 2.
8. Commit da transação.
9. Imprime resumo do audit log.

**Comando:** dentro do servidor de produção, na pasta do projeto:

```bash
cd /caminho/para/MktPlace-P2P/apps/api
NODE_ENV=production npm run bootstrap-prod
```

**Saída esperada:**

```
═══ Bootstrap de masters em produção ═══
✓ NODE_ENV=production confirmado
✓ Banco alcançável (postgres://...mktplace)
? Email do Sócio A:  socio-a@dominio-real.com.br
? Hash bcrypt do Sócio A:  $2a$12$...
? Email do Sócio B:  socio-b@dominio-real.com.br
? Hash bcrypt do Sócio B:  $2a$12$...

Resumo (NADA foi escrito ainda):
  - Criar 2 usuários com role master
  - Deletar masters default se existirem (master@/admin@mktplace.com)
  - Flags forcePasswordReset=true e force2FASetup=true em ambos
? Confirmar? (digite "SIM, EXECUTAR"):  SIM, EXECUTAR

Executando transação...
✓ Sócio A inserido (id=...)
✓ Sócio B inserido (id=...)
✓ master@mktplace.com deletado
✓ admin@mktplace.com deletado
✓ Verificação: 2 usuários master no banco
✓ Transação comitada

Audit log (últimos 4 eventos):
  USER_CREATED  socio-a@dominio-real.com.br  por SYSTEM
  USER_CREATED  socio-b@dominio-real.com.br  por SYSTEM
  USER_DELETED  master@mktplace.com           por SYSTEM
  USER_DELETED  admin@mktplace.com            por SYSTEM

✓ Bootstrap concluído. Próximo passo: cada sócio acessa /auth/login
```

**Se der erro:**
- `NODE_ENV !== 'production'` → não rodar em outro ambiente que não prod real. Se for prod, conferir o `.env` ou variáveis do serviço.
- `Can't reach database server` → checar `DATABASE_URL` e conectividade do servidor com o banco.
- Erro de constraint em INSERT (ex.: email duplicado) → algum usuário com esse email já existe. Investigar antes de prosseguir; provavelmente runbook foi executado parcialmente antes.
- Script aborta antes do commit → **nada foi gravado** (atomicidade). Investigar e reexecutar.

**Quem executa:** Um sócio só roda o script (o que tem acesso SSH ao servidor de prod). Ambos os emails/hashes precisam estar disponíveis. **O outro sócio acompanha por compartilhamento de tela.**

---

### Passo 4 — Cada sócio acessa o app e faz primeiro login com senha temp

**O que acontece:** com os usuários no banco e o app rodando (mesmo que isolado por VPN/whitelist), cada sócio abre o navegador e tenta logar com email + senha temporária do Passo 1.

**Comando:** abrir no navegador:

```
https://app.mktplace.com.br/auth/login
```

Digitar email + senha temporária.

**Saída esperada:** login bem-sucedido, mas o app **imediatamente** redireciona para `/auth/setup-password` (porque `forcePasswordReset=true`).

**Se der erro:**
- `Email ou senha inválidos` → conferir se a senha digitada é a mesma que gerou o hash no Passo 2. Erro mais comum: copiar/colar pegou espaço extra.
- App não redireciona, fica em `/dashboard` → o middleware de force-reset não está aplicado. **Parar e investigar.** Sócio NÃO deve continuar usando a conta nesse estado — significa que o código de proteção não está rodando.

**Quem executa:** Ambos, separadamente, cada um na própria máquina.

---

### Passo 5 — Definir senha definitiva (rota `/auth/setup-password`)

**O que acontece:** o app pede a nova senha. Cada sócio gera uma senha **definitiva** (forte, no Bitwarden) e digita aqui. Após salvar, `forcePasswordReset` vira `false` no banco.

**Comando:** dentro da UI:

1. Gerar nova senha forte no gerenciador (Bitwarden / 1Password): mínimo 16 caracteres, mix de letras/números/símbolos.
2. **Salvar no gerenciador ANTES de submeter** (se a tela travar depois, a senha está perdida).
3. Digitar a nova senha duas vezes no formulário.
4. Submit.

**Saída esperada:** redirect imediato para `/auth/setup-2fa` (porque `force2FASetup` ainda é `true`).

**Se der erro:**
- "Senha muito fraca" → respeitar política de senha do app. Reler requisitos.
- Submit volta para `/auth/setup-password` sem feedback → erro de rede. Tentar de novo; a senha não foi gravada (transação atômica no backend).
- App vai para `/dashboard` em vez de `/auth/setup-2fa` → `force2FASetup` não está sendo respeitado. **Parar.** A janela sem 2FA é exatamente o que este runbook está prevenindo.

**Quem executa:** Ambos, separadamente.

---

### Passo 6 — Habilitar 2FA (rota `/auth/setup-2fa`)

**O que acontece:** o app gera um QR code e um secret TOTP. O sócio escaneia com o app authenticator e digita o código de 6 dígitos para confirmar. Em seguida, o app exibe 10 **backup codes** (gerados via `crypto.randomBytes` — fix do CRIT-06). Esses códigos servem para recuperação se o sócio perder o celular.

**Comando:**

1. Abrir Authy / Google Authenticator no celular.
2. "Adicionar conta" → escanear QR code da tela.
3. Confirmar que o app authenticator agora mostra um código de 6 dígitos rotativo a cada 30s.
4. Digitar o código atual no formulário do app web.
5. Submit.
6. O app web exibe **10 backup codes** em formato `XXXX-XXXX-XX`.
7. **Anotar os 10 códigos em papel** (não em arquivo digital).
8. Guardar o papel no cofre físico decidido nos pré-requisitos.

**Saída esperada:** após salvar os backup codes, o app redireciona para `/dashboard` e o sócio agora tem acesso completo de master.

**Se der erro:**
- Código TOTP não aceito → relógio do celular fora de sincronia. Em Android: Configurações → Data e hora → "definir automaticamente". Em iOS: idem. Tentar de novo após sincronizar.
- Tela de backup codes some antes de anotar → ela só aparece uma vez. **Não voltar para o dashboard sem ter anotado.** Se aconteceu, ir em Configurações → Segurança → "Regenerar Backup Codes" para invalidar os perdidos e gerar novos.

**Quem executa:** Ambos, separadamente.

---

### Passo 7 — Verificação cruzada entre sócios

**O que acontece:** sócios validam o trabalho um do outro. Confirma que ambos têm acesso e que ninguém configurou nada errado.

**Comando:**

1. Cada sócio faz logout e tenta login de novo, completo, com 2FA. Confirma que funciona.
2. Cada sócio tenta usar **um** backup code para login (consome um dos 10 — sobram 9). Confirma que funciona.
3. Cada sócio confirma na UI: Configurações → Segurança → "Backup codes restantes: 9".
4. Cada sócio confere o painel admin: ele consegue ver a lista de roles e o próprio nome aparece como master.

**Saída esperada:** todos os 4 sub-passos OK em ambos os sócios.

**Se der erro:**
- Algum sócio não consegue logar → recuperar pelo backup code; se nem isso funciona, ver [Plano de recuperação](#plano-de-recuperação-em-desastre).
- Algum sócio aparece com role diferente de master → houve erro no INSERT do Passo 3. **Não tentar corrigir via UI agora** (estado inconsistente). Rodar [recuperação](#cenário-bootstrap-falha-no-meio-rollback).

**Quem executa:** Ambos, em paralelo, comunicando-se na chamada.

---

### Passo 8 — Confirmar audit log

**O que acontece:** evidência registrada permanentemente de que o bootstrap foi feito corretamente. Útil para auditorias futuras, compliance, e revisões internas.

**Comando:** um dos sócios (qualquer) acessa o painel admin → Audit Logs → filtra pelas últimas 2 horas. Confere que existem:

- `USER_CREATED` para `socio-a@dominio-real.com.br`
- `USER_CREATED` para `socio-b@dominio-real.com.br`
- `USER_DELETED` para `master@mktplace.com` (se existia)
- `USER_DELETED` para `admin@mktplace.com` (se existia)
- `PASSWORD_CHANGED` para ambos os sócios
- `2FA_ENABLED` para ambos os sócios

**Saída esperada:** 8 eventos (ou 6, se os defaults não existiam previamente).

**Se der erro:**
- Algum evento ausente → o sistema de audit não capturou. **Parar e investigar** antes de abrir prod ao público — sem trilha de auditoria não há compliance.
- Eventos fora de ordem (ex.: `2FA_ENABLED` antes de `PASSWORD_CHANGED`) → fluxo de força-reset/força-2FA tem bug. Reportar.

**Quem executa:** Sócio A (com Sócio B acompanhando por screen share).

---

### Passo 9 — Abrir DNS público

**O que acontece:** remoção do isolamento de rede. A partir daqui o app passa a receber tráfego público real.

**Comando:** depende da infra escolhida — pode ser:

- Remover regra de firewall que limitava por IP.
- Apontar registro A/AAAA do DNS para o IP público.
- Ativar Cloudflare WAF + DNS proxy.

**Saída esperada:** acesso externo (de uma 4G, por exemplo) consegue chegar em `https://app.mktplace.com.br`.

**Se der erro:**
- Domínio não resolve → propagação de DNS (até 48h, geralmente 5-30min). Esperar.
- 502/504 → app não está respondendo no IP exposto. Conferir saúde do serviço.

**Quem executa:** Sócio que tem acesso ao painel da infra. Outro sócio confirma de uma rede externa que o app responde.

**Após este passo:** o bootstrap está concluído. Documentar no arquivo externo (cofre/wiki interna): data/hora exata, emails finais dos dois masters, localização dos backup codes em papel de cada sócio, próxima data de revisão (recomendado: 90 dias para confirmar que ambos ainda têm acesso).

---

## Anatomia do script `bootstrap-prod.ts`

O script ainda **não foi escrito**. Esta seção descreve o que ele DEVE fazer, em prosa e pseudo-código, para servir de especificação na sprint que fechar SER-15 ([Pré-requisitos de código](#pré-requisitos-de-código-ainda-não-implementados)).

### Comportamento esperado

1. **Validação de ambiente:** confirma `NODE_ENV === 'production'`. Se não, aborta com erro explicando que este script só roda em prod (espelho do guard em `seed.ts`).
2. **Conexão:** instancia o PrismaClient e valida que o banco é alcançável e a migration de schema está aplicada. Aborta se a tabela `User` não existir.
3. **Inputs interativos:** pede via prompt (não argv, para evitar histórico bash com hashes):
   - Email do Sócio A
   - Hash bcrypt do Sócio A
   - Email do Sócio B
   - Hash bcrypt do Sócio B
4. **Validação de inputs:**
   - Emails são válidos sintaticamente.
   - Hashes parecem bcrypt válido (`$2a$12$...` ou `$2b$12$...`, total ~60 chars).
   - Emails dos dois são diferentes entre si.
   - Nenhum dos emails é `master@mktplace.com` ou `admin@mktplace.com` (defaults proibidos).
5. **Resumo + confirmação dupla:** mostra o que vai acontecer e exige que o operador digite literalmente `SIM, EXECUTAR`. Qualquer outra coisa aborta.
6. **Transação atômica:** uma única `prisma.$transaction(async tx => {...})` com:
   - `tx.user.create()` para Sócio A com `forcePasswordReset=true`, `force2FASetup=true`, `roleId=<master>`, `legacyRole='MASTER'`.
   - `tx.user.create()` para Sócio B com mesmas flags.
   - `tx.user.deleteMany({ where: { email: { in: ['master@mktplace.com', 'admin@mktplace.com'] } } })`.
   - Inserção dos 8 eventos de audit log correspondentes (`USER_CREATED` x2 e `USER_DELETED` x até 2).
   - Query final dentro da TX: `tx.user.count({ where: { roleId: masterRoleId } })`. Se não for exatamente 2, lança erro → transação aborta automaticamente.
7. **Saída:** imprime resumo do audit log com `id` e `email`, e sai com código 0 se tudo OK.

### Pseudo-código (não-funcional, especificação)

```typescript
// apps/api/scripts/bootstrap-prod.ts — A SER ESCRITO na sprint que fecha SER-15

import { PrismaClient, Prisma } from '@prisma/client';
import prompt from 'prompts';

if (process.env.NODE_ENV !== 'production') {
  throw new Error('bootstrap-prod só roda em produção real');
}

const prisma = new PrismaClient();

async function main() {
  // 1-2. Conexão + sanidade
  await prisma.$queryRaw`SELECT 1`;
  const masterRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'master' } });

  // 3. Inputs
  const inputs = await prompt([
    { type: 'text', name: 'emailA',  message: 'Email do Sócio A' },
    { type: 'password', name: 'hashA', message: 'Hash bcrypt do Sócio A' },
    { type: 'text', name: 'emailB',  message: 'Email do Sócio B' },
    { type: 'password', name: 'hashB', message: 'Hash bcrypt do Sócio B' },
  ]);

  // 4. Validação (omitida no pseudo-código)
  validateEmail(inputs.emailA);
  validateEmail(inputs.emailB);
  validateBcryptHash(inputs.hashA);
  validateBcryptHash(inputs.hashB);
  if (inputs.emailA === inputs.emailB) abort('Emails idênticos');
  if (FORBIDDEN_EMAILS.has(inputs.emailA) || FORBIDDEN_EMAILS.has(inputs.emailB)) {
    abort('Email default proibido em prod');
  }

  // 5. Confirmação
  const { confirm } = await prompt({
    type: 'text', name: 'confirm',
    message: 'Digite "SIM, EXECUTAR" para prosseguir',
  });
  if (confirm !== 'SIM, EXECUTAR') abort('Cancelado pelo operador');

  // 6. Transação atômica
  await prisma.$transaction(async (tx) => {
    const a = await tx.user.create({
      data: {
        email: inputs.emailA,
        password: inputs.hashA,
        roleId: masterRole.id,
        legacyRole: 'MASTER',
        forcePasswordReset: true, // schema pendente — SER-15
        force2FASetup: true,      // schema pendente — SER-15
      },
    });
    const b = await tx.user.create({
      data: {
        email: inputs.emailB,
        password: inputs.hashB,
        roleId: masterRole.id,
        legacyRole: 'MASTER',
        forcePasswordReset: true,
        force2FASetup: true,
      },
    });
    await tx.user.deleteMany({
      where: { email: { in: ['master@mktplace.com', 'admin@mktplace.com'] } },
    });

    // Audit log (estrutura a confirmar — pode usar AuditLogService existente)
    await tx.auditLog.createMany({ data: [
      { type: 'USER_CREATED', subjectId: a.id, actorId: 'SYSTEM' },
      { type: 'USER_CREATED', subjectId: b.id, actorId: 'SYSTEM' },
      // + USER_DELETED para cada default que foi de fato deletado
    ]});

    const count = await tx.user.count({ where: { roleId: masterRole.id } });
    if (count !== 2) throw new Error(`Esperado 2 masters, encontrado ${count}`);
  });

  // 7. Saída
  console.log('✓ Bootstrap concluído. Dois masters ativos.');
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
```

> Este pseudo-código **não compila** — depende de campos de schema (`forcePasswordReset`, `force2FASetup`) e infra de audit log que ainda não existem. É especificação, não implementação.

---

## O que NÃO fazer (anti-patterns)

Cada um destes erros já foi cometido por alguém em algum sistema. Lista é proteção contra repetir.

- ❌ **Logar como master padrão e criar sócios via UI.** Existe uma janela entre "logou no master default" e "criou sócios" em que o sistema está com credencial pública ativa, possivelmente sem 2FA, exposto. Mesmo se for 30 segundos, é tempo suficiente.

- ❌ **INSERT sócios sem DELETE defaults na mesma transação.** Se INSERT der certo mas DELETE não, ficam 2 masters + 2 defaults — defaults seguem usáveis. Pior: se DELETE rodar antes do INSERT e algo falhar, fica zero masters e o sistema vira inacessível.

- ❌ **Compartilhar senhas plain entre sócios (até temporárias).** A senha do Passo 1 é gerada por cada sócio, fica no gerenciador dele, é digitada pelo navegador dele. Nenhum sócio vê a senha do outro nunca.

- ❌ **Pular o setup-2fa "pra fazer depois".** "Depois" no contexto de credencial master é "nunca". A flag `force2FASetup=true` existe justamente para tornar isto não-pulável; se você está pensando em bypassar, o código tem um bug.

- ❌ **Rodar o script sem o outro sócio presente.** Bootstrap é cerimônia, não tarefa de manhã de sábado. Os dois precisam estar lá para revisar, dar contexto e detectar erro em tempo real.

- ❌ **Anotar backup codes em arquivo digital.** Backup codes são a última linha de defesa quando o celular sumiu. Se eles estiverem no mesmo gerenciador de senha que a senha definitiva, comprometer o gerenciador derruba 2FA inteiro. Papel no cofre é o padrão.

- ❌ **Reutilizar a senha temporária do Passo 1 como senha definitiva no Passo 5.** A senha do Passo 1 pode ter passado por canais menos seguros (chat, voz). A senha do Passo 5 nasce já dentro de um navegador com TLS válido.

- ❌ **Documentar quem é fallback de quem no próprio repo do código.** Documentação operacional de credenciais vai em cofre/wiki interna, não em commit público.

---

## Plano de teste

Antes de executar em prod, este runbook precisa ser ensaiado. Cada ensaio gera ajustes no texto (passos confusos, comandos com pegadinhas, erros não previstos).

### Ensaio 1 — Dev local (3-4 iterações)

**Objetivo:** alinhar mecânica básica. Cada sócio sozinho, executando contra Postgres local rodando em Docker.

- Reset do banco antes de cada ensaio: `cd apps/api && npx prisma migrate reset --force`.
- Rodar RBAC seed antes (`npx tsx prisma/seeds/rbac-seed.ts`).
- Executar bootstrap simulado (script ainda não existe — usar Prisma Studio manualmente ou um sed-like script).
- Cronometrar: tempo total deve cair em cada repetição. Se subir, há ambiguidade no runbook → ajustar texto.

**Sair quando:** o runbook completo for executável em ≤ 30 minutos consistentemente.

### Ensaio 2 — Staging (1 vez, dry-run completo)

**Objetivo:** validar contra ambiente "quase prod" — mesma imagem do servidor, mesma config de KMS, mesmo middleware de força-reset.

- Dois sócios na chamada, exatamente como será em prod.
- Executar do início ao fim, sem pular nenhum passo, incluindo Passo 9 (abrir DNS interno de staging).
- Documentar ajustes finais.

**Sair quando:** ambos os sócios completarem com sucesso e a verificação do audit log no Passo 8 mostrar os 8 eventos esperados.

### Ensaio 3 — Produção (execução real)

**Objetivo:** o procedimento de verdade. Se Ensaios 1 e 2 foram sólidos, este é só execução.

- Marcar com 1 semana de antecedência.
- Confirmar todos os checklist de pré-requisitos.
- Executar.
- Documentar timestamp exato no cofre/wiki.

---

## Pré-requisitos de código (ainda não implementados)

Este runbook é uma **especificação de operação**, não um manual de uso. Para virar manual de uso, os seguintes itens de código precisam existir. Cada um é uma tarefa concreta para a sprint que vai fechar SER-15.

- [ ] **Schema:** adicionar campos `forcePasswordReset Boolean @default(false)` e `force2FASetup Boolean @default(false)` ao model `User` em `prisma/schema.prisma`. Gerar migration.
- [ ] **Middleware:** criar ou estender o middleware de autenticação para redirecionar requests autenticadas:
  - Se `req.user.forcePasswordReset === true` e a rota não for `/auth/setup-password` ou `/auth/logout`, redirect 302 para `/auth/setup-password`.
  - Se `req.user.force2FASetup === true` (e force-reset já é false) e a rota não for `/auth/setup-2fa` ou `/auth/logout`, redirect 302 para `/auth/setup-2fa`.
  - Se nem flag está set, fluxo normal.
- [ ] **Endpoint `POST /auth/setup-password`:** valida senha forte (mesma policy de cadastro), hash bcrypt 12 rounds, `UPDATE users SET password=..., forcePasswordReset=false WHERE id=req.user.id`, emite evento `PASSWORD_CHANGED` no audit log.
- [ ] **Endpoint `POST /auth/setup-2fa`:** valida que o usuário passou da fase de senha (`forcePasswordReset=false`), gera secret TOTP, retorna QR + 10 backup codes (via `generateBackupCodes(10)` do `twoFactorService` — já corrigido em CRIT-06), persiste hash dos backup codes, marca `twoFactorEnabled=true`, `force2FASetup=false`. Emite `2FA_ENABLED` no audit log.
- [ ] **Frontend `/auth/setup-password`:** tela com dois campos de senha + confirmação, política visual de força (mín. 16 chars, etc.), submit + redirect para `/auth/setup-2fa`.
- [ ] **Frontend `/auth/setup-2fa`:** tela com QR code, campo TOTP, após sucesso exibe os 10 backup codes em formato `XXXX-XXXX-XX` com botão "copiar todos" e aviso forte de "anote em papel e guarde em local seguro — esta tela não volta".
- [ ] **Script `apps/api/scripts/bootstrap-prod.ts`:** implementar conforme [Anatomia](#anatomia-do-script-bootstrap-prodts). Adicionar npm script: `"bootstrap-prod": "tsx scripts/bootstrap-prod.ts"`.
- [ ] **Audit log:** verificar se os tipos `USER_CREATED`, `USER_DELETED`, `PASSWORD_CHANGED`, `2FA_ENABLED` já existem na infra atual ou se precisam ser adicionados. Verificar se `AuditLogService.log()` (ou equivalente) já é chamado nesses pontos.

Quando todos os itens acima existirem em main, este runbook deixa de ser ficção e vira manual de uso.

---

## Plano de recuperação em desastre

Cenários que vão acontecer eventualmente. Soluções pré-acordadas.

### Cenário: Sócio perde acesso ao 2FA (backup codes consumidos)

**Sintoma:** sócio trocou celular, app authenticator não migrou. Foi tentar login, 2FA cobrado, abriu backup codes em papel, mas todos os 10 já foram usados (em ensaios, ou em recuperações anteriores não documentadas).

**Resposta:**

1. Sócio afetado **liga** para o outro sócio (não chat, não email — voz).
2. Sócio com acesso loga normalmente, vai em Admin → Users → procura o sócio afetado.
3. Confirma identidade do outro sócio por **pergunta pessoal não documentada digitalmente** (ex.: "qual era o nome do nosso primeiro cliente piloto?"). Voz reconhecível + pergunta = autenticação humana.
4. Sócio com acesso usa endpoint admin: `POST /admin/users/:id/disable-2fa` (a ser implementado se ainda não existe). Audit log registra `2FA_DISABLED_BY_ADMIN` com `actorId` do sócio que executou.
5. Sócio afetado loga (sem 2FA temporariamente), passa pelo `force2FASetup` automático (mesma flag, basta o admin endpoint marcar `force2FASetup=true` ao desabilitar), reconfigura.
6. Sócio afetado anota novos backup codes em papel, guarda no cofre.

**Documentar no incident log:** data, motivo, qual sócio recuperou qual.

### Cenário: Sócio perde acesso à senha

**Sintoma:** sócio quer logar mas a senha do Bitwarden sumiu (vault corrompido, conta Bitwarden bloqueada, etc.).

**Resposta:**

1. Sócio afetado liga para o outro.
2. Sócio com acesso vai em Admin → Users → escolhe o sócio afetado → "Forçar reset de senha" (marca `forcePasswordReset=true`). Audit log: `PASSWORD_RESET_FORCED_BY_ADMIN`.
3. Sócio com acesso gera uma senha temporária aleatória nova (mesmo método do Passo 1), gera o hash (Passo 2), e **usa endpoint admin** `POST /admin/users/:id/set-password-hash` (a ser implementado) — passando só o hash, nunca a senha plain por canal compartilhado.
4. Sócio com acesso transmite a **senha plain** para o sócio afetado por canal seguro: Signal mensagem-desaparecente, ou voz na chamada (e o afetado anota no novo Bitwarden imediatamente).
5. Sócio afetado loga com a temp, passa pelo `force-password-reset`, define senha definitiva, salva no Bitwarden.
6. 2FA não é resetado neste cenário — só a senha. Login completo ainda exige TOTP.

### Cenário: Servidor corrompe DB durante bootstrap

**Sintoma:** Passo 3 do runbook, o script aborta no meio com erro de I/O do disco, ou perda de conexão.

**Resposta:**

1. **Não tentar de novo imediatamente.** O Passo 3 é uma transação atômica — se abortou antes do commit, nada foi gravado, mas verificar é essencial.
2. Conectar ao banco diretamente: `psql $DATABASE_URL`.
3. `SELECT email FROM "User" WHERE "roleId" = (SELECT id FROM "Role" WHERE slug='master');` — esperado: 0 ou 2 linhas. Se for 1, a transação não foi atômica como deveria (bug do script).
4. Se 0 linhas e nenhum default presente, simplesmente reexecutar o bootstrap após investigar o erro de disco/conexão.
5. Se 1 linha (estado inconsistente), abrir conexão psql direta e fazer rollback manual:
   ```sql
   BEGIN;
   DELETE FROM "User" WHERE "roleId" = (SELECT id FROM "Role" WHERE slug='master');
   -- conferir COUNT antes de commitar
   COMMIT;
   ```
6. Investigar a causa do erro original (disco cheio? rede instável?) **antes** de reexecutar.

### Cenário: Bootstrap falha no meio (rollback)

**Sintoma:** script aborta após o `prompts` mas antes do `COMMIT`. Erro tipo `unique constraint violation` no INSERT do segundo sócio.

**Resposta:**

1. Pela atomicidade Postgres, nada foi gravado. Verificar com `SELECT COUNT(*) FROM "User" WHERE email IN ('socio-a@...', 'socio-b@...');` → esperado 0.
2. Identificar a causa: emails idênticos? hash mal-formado? validação ausente no script?
3. Corrigir input e reexecutar do Passo 3.
4. Se a verificação retornou número diferente de 0, investigar quem inseriu — pode ter sido o seed default rodando antes (mesmo com guard) ou um INSERT manual. Limpar com `DELETE` antes de reexecutar.

### Cenário: Apenas um sócio disponível em emergência (single-master operation)

**Sintoma:** o outro sócio sumiu por mais de 72h (acidente, problema de saúde, decisão de sair). É necessário operar prod enquanto a situação se resolve.

**Resposta:**

1. **Não criar um terceiro master** unilateralmente. Isto subverte o princípio de dois masters independentes.
2. O sócio disponível pode operar normalmente — todas as permissões master estão na conta dele. O que se perde é o **second-pair-of-eyes**.
3. Para ações **destrutivas** (deletar usuário, mover fundos da plataforma, alterar permissões críticas), regra interna: aguardar 48h após o último contato com o outro sócio antes de executar sozinho. Documentar cada ação destrutiva no audit log com justificativa.
4. Se o outro sócio ficar permanentemente inacessível: cerimônia formal (documentada, com testemunhas) para promover um segundo master de confiança. Não é decisão de minuto.
5. Considerar uma cláusula no acordo de sócios cobrindo este cenário antes que ele aconteça.

---

## Glossário rápido

- **2FA / TOTP** — autenticação de dois fatores. Você loga com senha + código de 6 dígitos que muda a cada 30s.
- **Bcrypt** — algoritmo de hash de senha. O banco armazena o hash, nunca a senha plain.
- **Backup code** — código de uma vez usável para login sem 2FA, quando o celular sumiu. Anotado em papel.
- **Bootstrap** — primeira execução, criar do zero, "ligar o sistema".
- **SPOF** — Single Point Of Failure. Algo que, se falhar, derruba o sistema inteiro.
- **Transação atômica** — sequência de operações que ou acontecem todas, ou nenhuma. Sem meio-termo.
- **`forcePasswordReset` / `force2FASetup`** — flags no usuário que obrigam o app a redirecionar para a tela de setup correspondente até a flag virar `false`. Maneira de criar usuários "incompletos" que ganham acesso só depois de configurar.
