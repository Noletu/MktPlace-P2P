# Runbook: Bootstrap de Masters em Produção

> **Status:** Documentação — código de suporte ainda não implementado (veja [Pré-requisitos de código](#pré-requisitos-de-código-ainda-não-implementados)).
> **Última atualização:** 2026-05-15
> **Owners:** Sócio 1, Sócio 2
> **Referências:** TECH-DEBT-OP02 · SER-15 (mitigação parcial via commits `17fea25` + `0e4f5eb`) · CRIT-08

> 📖 **Como ler este runbook:** se você nunca usou terminal, SSH ou bcrypt antes, **comece pelo [Apêndice A](#apêndice-a--instalação-de-ferramentas-necessárias)** (instalação das ferramentas) e pelo [Apêndice B](#apêndice-b--glossário-expandido) (glossário com analogias). Volte aqui para os passos depois.

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
- [ ] Migration `add_hd_account_index` aplicada (`npx prisma migrate deploy`) — cria `user_hd_account_seq` e coluna `User.hdAccountIndex`
- [ ] RBAC seed executado em prod (`npx tsx prisma/seeds/rbac-seed.ts`) — neste momento o guard `NODE_ENV=production` AINDA NÃO bloqueia o RBAC seed se ele for promovido a "migration controlada"; por enquanto, este passo é executado uma vez antes de ativarmos o guard em prod. Veja TECH-DEBT-DEV01.
- [ ] App rodando mas **isolado** — firewall / IP whitelist / VPN. Nenhum usuário público consegue acessar.
- [ ] Ferramentas instaladas em ambos os PCs pessoais — veja [Apêndice A](#apêndice-a--instalação-de-ferramentas-necessárias). **Faça isto pelo menos uma semana antes do dia D**, especialmente o acesso SSH (Apêndice A.3).
- [ ] Ambos os sócios disponíveis na mesma videochamada (Meet/Zoom/Whereby), com vídeo ligado, durante todo o procedimento
- [ ] Ambos os sócios com gerenciador de senha pessoal (Bitwarden, 1Password) instalado e desbloqueado
- [ ] Ambos os sócios com app authenticator no celular (Authy, Google Authenticator, 1Password) — instruções no Apêndice A.4
- [ ] **Cofre físico** definido para guardar backup codes em papel — pode ser cofre da casa, cofre de aluguel em banco, ou caderno em local seguro. Decidido antes, não improvisar.
- [ ] Documento (fora do repo) preparado para registrar: data/hora do bootstrap, email de cada sócio, quem é fallback de quem, localização do cofre dos backup codes

---

## Quem está onde durante o bootstrap

Esta operação envolve **TRÊS contextos diferentes** que precisam ficar claros antes de começar. Cada passo deste runbook indica em qual contexto ele acontece.

### Contexto A — PC pessoal de cada sócio

Sócio 1 está no computador dele, em casa/escritório. Sócio 2 está no computador dele, em casa/escritório. Cada um usa o **próprio terminal local** (PowerShell no Windows, Terminal no Mac, bash no Linux).

**O que acontece aqui:**
- Gerar a senha temporária pessoal (Passo 1)
- Gerar o hash bcrypt da senha (Passo 2)
- Configurar o authenticator app no celular (Passo 6)

A senha temporária **NUNCA sai do PC pessoal**. Apenas o hash bcrypt é compartilhado (e mesmo o hash não revela a senha original — veja a analogia de bcrypt no [Apêndice B](#apêndice-b--glossário-expandido)).

### Contexto B — Servidor de produção (via SSH)

Servidor único e compartilhado, hospedado em provedor de nuvem (Supabase, AWS, etc.). Acessado via terminal SSH a partir do PC pessoal de quem tem permissão.

**O que acontece aqui:**
- Executar o script `bootstrap-prod` (que faz o INSERT dos sócios e DELETE dos defaults — Passo 3)
- Verificar audit log (Passo 8)

**Recomendação:** apenas UM dos sócios conecta no servidor (aquele com SSH configurado), com **tela compartilhada via videochamada** para o outro acompanhar em tempo real. Atomicidade da transação SQL é mais importante que "ambos executam metade" — divisão do comando entre máquinas diferentes só introduz pontos de falha.

### Contexto C — Aplicação web (navegador)

O próprio app `app.mktplace.com.br` (ou domínio escolhido) rodando, acessado via navegador. **Cada sócio acessa do próprio PC.**

**O que acontece aqui:**
- Primeiro login com senha temporária (Passo 4)
- App força fluxo `/auth/setup-password` para definir senha definitiva (Passo 5)
- App força fluxo `/auth/setup-2fa` para escanear QR code (Passo 6)
- Verificação cruzada entre sócios (Passo 7)

### Setup obrigatório antes de começar

- ✅ Videochamada ativa entre os dois sócios (Google Meet, Zoom, etc.) com vídeo dos rostos ligado
- ✅ Compartilhamento de tela testado e funcionando
- ✅ Ambos com paciência de **aproximadamente 1 hora reservada** sem interrupções
- ✅ Celulares de ambos carregados (>50% de bateria) com authenticator instalado
- ✅ Caderno físico ou cofre **na mesa** para anotar backup codes (não buscar no meio do procedimento)
- ✅ Gerenciador de senha pessoal (Bitwarden, 1Password) aberto e desbloqueado para cada um
- ✅ Apêndice A inteiramente concluído **dias antes** — não tentar instalar ferramentas no dia D

### Diagrama do fluxo

```
PC do Sócio 1 (Contexto A)              PC do Sócio 2 (Contexto A)
──────────────────────────              ──────────────────────────
1. Gera senha temp (terminal)           4. Gera senha temp (terminal)
2. Gera hash bcrypt (terminal)          5. Gera hash bcrypt (terminal)
3. Anota senha no Bitwarden             6. Anota senha no Bitwarden
   │                                       │
   └── envia HASH (não a senha) ──┐    ┌── envia HASH (não a senha)
                                  ▼    ▼
                          Servidor de Produção (Contexto B)
                          ─────────────────────────────────
                          7. Sócio com SSH conecta no servidor
                             (compartilhando tela na chamada)
                          8. Executa npm run bootstrap-prod
                             Script roda transação SQL ÚNICA:
                               INSERT Sócio 1 (com hash dele)
                               INSERT Sócio 2 (com hash dele)
                               DELETE master@mktplace.com
                               DELETE admin@mktplace.com
                               VERIFY count = 2 master
                             COMMIT
   │                                       │
   ▼                                       ▼
PC do Sócio 1 (Contexto C)              PC do Sócio 2 (Contexto C)
──────────────────────────              ──────────────────────────
9.  Acessa app no navegador             13. Acessa app no navegador
10. Login com senha temp pessoal        14. Login com senha temp pessoal
11. App força /auth/setup-password      15. App força /auth/setup-password
    → define senha definitiva               → define senha definitiva
12. App força /auth/setup-2fa           16. App força /auth/setup-2fa
    → escaneia QR + anota                   → escaneia QR + anota
       backup codes em papel                   backup codes em papel

                            ↓

                  Verificação cruzada (Contexto C)
                  ────────────────────────────────
                  17. Logout + relogin com 2FA (ambos)
                  18. Teste de backup code (ambos consomem 1)
                  19. Confere audit log no painel admin
                  20. Abre DNS público
```

**Tempo total estimado:** 60–90 minutos do início (Passo 1) ao fim (Passo 9). A maior parte é cerimônia, não comando — não há pressa.

---

## Passo a passo

Cada passo usa um template fixo:

- **Contexto:** A (PC pessoal) / B (Servidor SSH) / C (App web)
- **Quem executa:** Sócio 1 / Sócio 2 / Ambos (separadamente) / Apenas um
- **Tempo estimado:** quanto leva quando dá tudo certo
- **O que vai acontecer:** prosa explicando o quê e por quê
- **Como fazer:** instruções numeradas, com onde encontrar o programa e o que digitar
- **O que esperar como resposta:** o que aparece na tela quando dá certo
- **O que fazer se der errado:** tabela `erro → significa → resolve`
- **Não passe para o próximo passo até:** checklist de prontidão

> ⚠️ Em qualquer ponto, se algo divergir do esperado, **parar** e investigar antes de continuar. Não há pressa para colocar prod no ar; há pressa para não criar conta inválida.

---

### Passo 1 — Cada sócio gera a própria senha temporária

**Contexto:** A — PC pessoal
**Quem executa:** Ambos, **separadamente** (cada um no próprio computador)
**Tempo estimado:** 5 minutos

#### O que vai acontecer

Cada sócio vai gerar, no próprio computador, uma senha aleatória forte de 32 caracteres. Essa senha será usada apenas no PRIMEIRO login — assim que entrar pela primeira vez, o sistema obriga a trocar por uma definitiva.

**Analogia:** é como gerar uma chave de uso único para destrancar uma porta. A chave em si não importa depois — o que importa é que ela seja imprevisível enquanto está em uso.

A senha **fica apenas no seu PC**. Você não envia ela para o outro sócio, nem para o servidor. Você só envia o "hash" dela (Passo 2).

#### Como fazer

**1.** Abra o terminal do seu computador.

  - **Windows:** clicar no botão Iniciar → digitar `Git Bash` → abrir. (Se não tiver Git Bash, veja Apêndice A.1.)
  - **Mac:** apertar `Cmd + Espaço` para abrir o Spotlight → digitar `Terminal` → Enter.
  - **Linux:** abrir o aplicativo Terminal do menu.

**2.** Você verá uma janela escura com texto claro. Geralmente aparece o nome do seu usuário, seguido de um símbolo `$` ou `>`, e um cursor piscando. Algo como:

```
lucas@MacBook ~ $ █
```

Esse cursor piscando indica que ele está pronto para receber um comando.

**3.** Digite EXATAMENTE este comando (sem aspas, sem mudar nada):

```bash
openssl rand -base64 32
```

> 💡 **O que esse comando faz, em português:** "OpenSSL, me dê 32 bytes aleatórios e formate em texto legível usando base64". `openssl` é o programa, `rand` é o subcomando (random = aleatório), `-base64 32` significa "32 bytes em base64".

  > ⚠️ **Atenção:** copie e cole, não digite à mão. Um espaço ou letra trocada e o comando falha.

**4.** Aperte `Enter`.

#### O que esperar como resposta

Logo abaixo do comando, aparece uma sequência de aproximadamente **44 caracteres** misturando letras maiúsculas, minúsculas, números e símbolos. Algo como:

```
qC2vK8m+sRtN7L1pXa9YdHfZuQwE3jBgVmK5n4oP=
```

Esta sequência é a sua senha temporária. **Selecione o texto** (clicando e arrastando o mouse, ou triplo-clique para selecionar a linha inteira) e copie com `Ctrl+C` (Windows/Linux) ou `Cmd+C` (Mac).

**5.** Abra seu gerenciador de senha (Bitwarden, 1Password) e crie uma nova entrada:
- **Nome:** `Master Mktplace — senha temporária 2026-05-15` (com a data de hoje)
- **Senha:** colar o que você copiou
- **Notas:** "Senha de UM USO. Vai ser trocada no primeiro login."

**6.** Salve. **Pronto.**

> 💡 **Você sabe que deu certo quando:** a string de ~44 caracteres está salva no seu gerenciador de senha e o terminal não mostrou nenhum erro vermelho.

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| `command not found: openssl` | O programa OpenSSL não está disponível no terminal | Apêndice A.1. No Windows, use Git Bash (não PowerShell normal). |
| `openssl: error: unknown option '-base64'` | Versão muito antiga do OpenSSL | Atualizar OpenSSL ou usar fallback: `node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"` |
| Saída tem caracteres estranhos / quebrada | Provavelmente erro de copy/paste do comando | Limpar a linha (Ctrl+C para cancelar) e digitar de novo |

Se aparecer algo diferente: **PARE**. Tire print da tela. Compartilhe com o outro sócio antes de continuar.

#### Não passe para o próximo passo até:

- [ ] A senha de ~44 caracteres está salva no seu gerenciador de senha pessoal
- [ ] Você confirma na videochamada que o outro sócio também gerou e salvou a dele
- [ ] **Nenhum dos dois** compartilhou a senha plain com o outro (a comunicação na chamada deve ser "salvei a minha", não "minha senha é X")

---

### Passo 2 — Cada sócio gera o hash bcrypt da própria senha

**Contexto:** A — PC pessoal
**Quem executa:** Ambos, **separadamente**
**Tempo estimado:** 10 minutos

#### O que vai acontecer

Você vai transformar a senha do Passo 1 em uma string "embaralhada" chamada **hash bcrypt**. O servidor de produção precisa do hash (não da senha) para guardar no banco. Quando você logar no app, o servidor compara o hash do que você digitou com o hash guardado — se baterem, libera entrada.

**Analogia:** imagine triturar um papel em uma trituradora de papel. Você não consegue reconstruir o papel original a partir das tiras, mas se você triturar outro papel idêntico, sai exatamente o mesmo padrão de tiras. Bcrypt funciona assim: um hash não revela a senha, mas a mesma senha sempre gera o mesmo hash (quando usa o mesmo "sal" — neste caso o hash inclui o sal junto, é só copiar o hash inteiro).

**Por que isso é importante:** você vai precisar enviar o hash para quem está operando o servidor. Hash é seguro de mandar por chat/Signal/voz — mesmo que vaze, ninguém consegue descobrir sua senha a partir dele (com bcrypt 12-rounds, levaria séculos de CPU). Já senha plain não pode passar por nenhum canal externo.

#### Como fazer

**1.** Permaneça no mesmo terminal aberto no Passo 1 (ou abra novo se fechou).

**2.** Verifique se Node.js está instalado digitando:

```bash
node --version
```

  Apertar Enter. Você deve ver algo como `v18.17.0` ou `v20.x.x`. Se aparecer "command not found", instale Node primeiro (Apêndice A.2) e volte.

**3.** Cole o seguinte comando no terminal, **mas substituindo `SUA-SENHA-AQUI` pela senha temp do Passo 1**:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'SUA-SENHA-AQUI'
```

> 💡 **O que esse comando faz, em português:** "Node, execute este código JavaScript — ele importa a biblioteca bcryptjs e pede pra ela gerar o hash da senha que está como primeiro argumento, com força 12. Aí imprime o resultado." As **aspas simples** em volta da senha são importantes para que caracteres especiais (como `+`, `=`, `/`) não sejam interpretados como comandos.

  > ⚠️ **Atenção:** sua senha do Passo 1 pode conter caracteres especiais. As aspas simples evitam problemas. **Se sua senha tem aspa simples dentro**, gere outra no Passo 1.

**4.** Apertar `Enter`.

> 💡 O comando pode demorar **2–3 segundos** rodando — é o bcrypt fazendo cálculo intencional para ser lento (essa lentidão é a defesa contra ataques de força bruta).

#### O que esperar como resposta

Aparece uma linha começando com `$2a$12$` ou `$2b$12$`, com aproximadamente **60 caracteres** no total:

```
$2a$12$LRwQ5N0Yt9YJ6vG2KEhc1OFNuHKzCJzv5K8mYBpQqXJwGZdYRb1Vm
```

Essa é a forma "embaralhada" da sua senha. Pode (e deve) compartilhar com quem vai operar o servidor.

**5.** Selecione e copie a string inteira (do `$2a$12$...` até o último caractere).

**6.** Envie para o sócio que vai operar o servidor via canal de chat criptografado (Signal recomendado, ou via voz na chamada lendo letra por letra — hash é seguro). **NÃO envie sua senha plain do Passo 1, só o hash deste passo.**

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| `command not found: node` | Node.js não instalado | Apêndice A.2 |
| `Cannot find module 'bcryptjs'` | A biblioteca bcryptjs não está acessível neste diretório | Mude para uma pasta do projeto (ex.: `cd ~/projetos/MktPlace-P2P/apps/api`) e tente de novo. Alternativa: `npm install -g bcryptjs` primeiro. |
| Hash com menos de 50 ou mais de 70 caracteres | Algo cortou a saída ou o argumento foi mal-passado | Não use esse hash. Repita o comando garantindo aspas simples corretas em volta da senha. |
| Saída em branco, sem erro | Provavelmente a senha não chegou como argumento | Confira se você substituiu `SUA-SENHA-AQUI` e manteve as aspas simples |

#### Não passe para o próximo passo até:

- [ ] Você tem o hash bcrypt de ~60 caracteres começando com `$2a$12$` ou `$2b$12$`
- [ ] Você enviou o hash (não a senha plain) para o sócio operador via canal seguro
- [ ] O sócio operador confirma na chamada que recebeu o hash de ambos os sócios

---

### Passo 3 — Sócio operador executa o script `bootstrap-prod` no servidor

**Contexto:** B — Servidor de produção (via SSH a partir do PC do operador)
**Quem executa:** **Apenas um sócio** — aquele com acesso SSH ao servidor. O outro acompanha por compartilhamento de tela.
**Tempo estimado:** 15 minutos

#### O que vai acontecer

O sócio operador vai se conectar no servidor de produção remotamente (usando SSH, que é como um "TeamViewer via texto"), e executar um script que faz **uma única operação atômica** no banco:

1. Cria o usuário do Sócio 1 (com o hash que o Sócio 1 enviou)
2. Cria o usuário do Sócio 2 (com o hash que o Sócio 2 enviou)
3. Apaga `master@mktplace.com` e `admin@mktplace.com` se existirem
4. Verifica que existem exatamente 2 masters no banco
5. Confirma a transação

**Analogia da "transação atômica":** imagine uma operação bancária de transferência entre duas contas — `tirar de A` e `colocar em B`. Se a luz cair no meio, você não pode terminar com `tirou de A` mas `não colocou em B`. Ou tudo acontece, ou nada acontece. É o que o `BEGIN ... COMMIT` do SQL faz aqui.

**Atenção:** o script ainda **não está implementado**. Esta versão do runbook descreve como ele DEVE funcionar quando existir (especificação está em [Anatomia do script](#anatomia-do-script-bootstrap-prodts)). Até lá, o procedimento alternativo é executar o SQL bloco a bloco manualmente via `psql`.

#### Como fazer

**1.** Confirme com o outro sócio (na chamada) que ele vai compartilhar a tela enquanto você executa.

**2.** No seu terminal local, conecte ao servidor via SSH:

```bash
ssh usuario@ip-do-servidor-de-producao
```

Substituir `usuario` pelo seu nome de usuário no servidor e `ip-do-servidor-de-producao` pelo IP ou hostname real.

> 💡 **O que é SSH:** Secure Shell. É um protocolo para abrir um terminal **dentro** de outro computador, pela internet, de forma segura (encriptada). Você digita comandos no seu PC, mas eles rodam no servidor remoto, e a resposta volta para sua tela.

  > ⚠️ Se essa é a primeira vez conectando, configure SSH **dias antes** seguindo o Apêndice A.3.

**3.** O servidor pede confirmação da chave (na primeira vez) ou sua senha SSH:

```
The authenticity of host 'ip (xxx.xxx.xxx.xxx)' can't be established.
ECDSA key fingerprint is SHA256:abc...xyz.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Digite `yes` e Enter (apenas na PRIMEIRA conexão; depois ele lembra).

**4.** Você agora está com um prompt do servidor, algo como:

```
admin@prod-server:~$
```

**5.** Navegue até a pasta da API:

```bash
cd /var/www/MktPlace-P2P/apps/api
```

(O caminho exato depende de onde o app foi instalado. Confirmar com quem provisionou o servidor.)

**6.** Confirme que está em produção real:

```bash
echo $NODE_ENV
```

  Deve retornar `production`. Se retornar vazio ou outra coisa, **PARE** — você está no lugar errado.

**7.** Execute o script (quando ele existir):

```bash
npm run bootstrap-prod
```

#### O que esperar como resposta

O script é interativo. Ele vai mostrar uma série de telas:

```
═══ Bootstrap de masters em produção ═══
✓ NODE_ENV=production confirmado
✓ Banco alcançável (postgres://...mktplace)
? Email do Sócio 1:  ▮
```

O cursor pisca esperando o email do Sócio 1. **Digite o email definitivo** do Sócio 1 (ex.: `socio1@dominio-real.com.br`), Enter.

```
? Hash bcrypt do Sócio 1:  ▮
```

Cole o hash do Sócio 1 que você recebeu no Passo 2. Enter.

Repita para Sócio 2 (email + hash).

O script mostra um resumo:

```
Resumo (NADA foi escrito ainda):
  - Criar 2 usuários com role master
  - Deletar masters default se existirem (master@/admin@mktplace.com)
  - Flags forcePasswordReset=true e force2FASetup=true em ambos
? Confirmar? (digite "SIM, EXECUTAR"):  ▮
```

**Leia o resumo em voz alta na chamada com o outro sócio.** Se ambos confirmam que está correto, digite `SIM, EXECUTAR` (com vírgula e maiúsculas, exatamente assim), Enter.

```
Executando transação...
✓ Sócio 1 inserido (id=clxxx...)
✓ Sócio 2 inserido (id=clyyy...)
✓ master@mktplace.com deletado
✓ admin@mktplace.com deletado
✓ Verificação: 2 usuários master no banco
✓ Transação comitada

Audit log (últimos 4 eventos):
  USER_CREATED  socio1@dominio-real.com.br  por SYSTEM
  USER_CREATED  socio2@dominio-real.com.br  por SYSTEM
  USER_DELETED  master@mktplace.com           por SYSTEM
  USER_DELETED  admin@mktplace.com            por SYSTEM

✓ Bootstrap concluído. Próximo passo: cada sócio acessa /auth/login
```

> 💡 **Você sabe que deu certo quando:** a linha `✓ Transação comitada` aparece, seguida do audit log com os 4 eventos.

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| `NODE_ENV !== 'production'` | Variável de ambiente errada no servidor | Conferir `.env` do servidor ou as variáveis do serviço systemd / PM2 / Docker |
| `Can't reach database server` | App não consegue conversar com o Postgres | Conferir `DATABASE_URL`, firewall do banco, e se o Postgres está rodando |
| `Unique constraint failed on the fields: (email)` | Já existe usuário com esse email | Algum INSERT manual aconteceu antes. Investigar antes de prosseguir (NÃO sobrescrever); ver [Plano de recuperação](#plano-de-recuperação-em-desastre). |
| Script aborta antes de "Transação comitada" | **Nada foi gravado** (atomicidade SQL). Estado igual ao antes. | Ler a mensagem de erro, corrigir o input, e reexecutar do Passo 7. |
| `Erro: count = 1` ou `count = 3` | Verificação interna falhou — quantidade errada de masters | NÃO comitar. Sair do script (Ctrl+C se travado). Investigar manualmente com `psql`. |

#### Não passe para o próximo passo até:

- [ ] A linha `✓ Transação comitada` apareceu
- [ ] O audit log mostrou `USER_CREATED` para os 2 sócios novos
- [ ] O outro sócio confirmou pela chamada que viu o mesmo na tela compartilhada
- [ ] Você fez `exit` para sair do servidor (ou pelo menos sabe que pode fechar essa janela do terminal — o trabalho no Contexto B acabou por enquanto)

---

### Passo 4 — Cada sócio faz primeiro login com a senha temporária

**Contexto:** C — App web
**Quem executa:** Ambos, **separadamente** (cada um no próprio navegador)
**Tempo estimado:** 5 minutos

#### O que vai acontecer

Com os usuários criados no banco e o app rodando (mesmo isolado por VPN/whitelist), cada sócio abre o navegador e faz login pela primeira vez usando seu email + a senha temporária que gerou no Passo 1.

O app vai **imediatamente** detectar a flag `forcePasswordReset=true` e redirecionar para a tela de "definir nova senha" (Passo 5). Você NÃO terá acesso a nada do dashboard antes de definir a senha definitiva.

#### Como fazer

**1.** Abra seu navegador preferido (Chrome, Firefox, Edge, Safari).

**2.** Acesse a URL do app:

```
https://app.mktplace.com.br/auth/login
```

(Substituir pelo domínio real se for diferente.)

**3.** Na tela de login, preencha:
- **Email:** seu email definitivo (mesmo que o sócio operador inseriu no Passo 3)
- **Senha:** a senha temporária do Passo 1 (cole direto do seu Bitwarden — não digite à mão)

**4.** Clique em **Entrar** (ou Login).

#### O que esperar como resposta

A página carrega por um segundo e **redireciona automaticamente** para uma nova URL:

```
https://app.mktplace.com.br/auth/setup-password
```

A tela exibida pede para você definir uma nova senha. Você NÃO vê o dashboard normal — você vê uma tela "definir senha definitiva".

> 💡 **Você sabe que deu certo quando:** a URL no navegador mudou para `/auth/setup-password` automaticamente, sem você clicar em nada.

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| `Email ou senha inválidos` | A senha digitada não bate com o hash no banco | 1) Confirme o email exato. 2) Cole a senha do Bitwarden de novo — pode ter pegado um espaço extra. 3) Confirme com o operador se o hash do seu sócio (no Passo 3) era o seu mesmo. |
| Login funciona mas vai pro dashboard normal | A flag `forcePasswordReset` não está vigorando | **PARE.** O middleware de proteção não está aplicado. Avisar o sócio operador e investigar antes de continuar — significa que prod está sem proteção. |
| Página em branco / erro 500 | App quebrou | Print da tela, mostrar pro operador. Sem isolamento (DNS público fechado por enquanto), só os dois sócios podem testar. |
| `Conexão recusada` | Você não está dentro da VPN ou IP whitelist | Conferir VPN ativa. Se quem provisionou disse "tem que estar no VPN da empresa", abrir o VPN antes. |

#### Não passe para o próximo passo até:

- [ ] Seu navegador está em `/auth/setup-password`
- [ ] O outro sócio confirma pela chamada que também está em `/auth/setup-password`
- [ ] Nenhum dos dois conseguiu acessar `/dashboard` direto após o login

---

### Passo 5 — Cada sócio define a senha definitiva

**Contexto:** C — App web
**Quem executa:** Ambos, **separadamente**
**Tempo estimado:** 5 minutos

#### O que vai acontecer

Agora você vai trocar a senha temporária (que pode ter passado por canais menos seguros como chat ou voz) por uma definitiva, gerada e armazenada **exclusivamente** dentro do seu gerenciador de senha pessoal.

Esta senha nasce dentro do seu navegador com TLS, dentro do seu Bitwarden, e nunca sai daí. **Use o gerador do próprio gerenciador** para criá-la — não invente.

#### Como fazer

**1.** Antes de qualquer outra coisa, abra seu gerenciador (Bitwarden / 1Password) e crie uma nova entrada:
- **Nome:** `Master Mktplace — senha definitiva`
- **Email:** seu email do app
- **Senha:** clique no botão de **gerar senha** e configure:
  - Comprimento: **mínimo 20 caracteres**
  - Tipo: letras maiúsculas + minúsculas + números + símbolos
  - Clique em "Salvar" para colocar no vault

**2.** Volte ao navegador, na tela `/auth/setup-password`.

**3.** Cole a senha do gerenciador no campo "Nova senha".

**4.** Cole a mesma senha no campo "Confirmar senha" (geralmente o gerenciador tem botão de "preencher" que faz isso automaticamente).

**5.** Clique em **Salvar** (ou "Definir senha", como o botão for chamado).

> ⚠️ **CRÍTICO:** salve a senha no gerenciador ANTES de clicar em Salvar. Se a página travar ou der erro de rede no meio, e você não tiver salvado, a senha está perdida — e você não conseguirá logar de novo. O bcrypt da senha já estará no banco, mas você nem sabe qual senha gerou aquele hash.

#### O que esperar como resposta

A página carrega e redireciona automaticamente para:

```
https://app.mktplace.com.br/auth/setup-2fa
```

A nova tela mostra um QR code grande e uma instrução pra escanear com o app authenticator.

> 💡 **Você sabe que deu certo quando:** a URL mudou para `/auth/setup-2fa` e você vê um QR code.

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| `Senha muito fraca` | Política do app rejeitou a senha | Ler os requisitos da tela. Geralmente precisa de letra maiúscula + número + símbolo. Use o gerador do Bitwarden. |
| Submit volta para a mesma tela sem feedback claro | Erro de rede ou validação silenciosa | Conferir console do navegador (F12 → aba Console). Tentar de novo. A senha definitiva NÃO foi gravada se o submit falhou — está seguro repetir. |
| Após submit vai para `/dashboard` em vez de `/auth/setup-2fa` | `force2FASetup` não está sendo respeitado | **PARE.** Avisar operador. A janela "sem 2FA" é justamente o que este runbook está prevenindo. |
| Você esqueceu de salvar no gerenciador antes de submeter, e agora não lembra a senha | Coisa séria | Ver [Plano de recuperação: Sócio perde acesso à senha](#cenário-sócio-perde-acesso-à-senha). |

#### Não passe para o próximo passo até:

- [ ] A senha definitiva está salva no seu gerenciador
- [ ] O navegador está em `/auth/setup-2fa` mostrando o QR code
- [ ] O outro sócio confirma pela chamada o mesmo estado

---

### Passo 6 — Cada sócio habilita o 2FA com QR code + anota backup codes em papel

**Contexto:** C — App web + celular
**Quem executa:** Ambos, **separadamente**
**Tempo estimado:** 10 minutos

#### O que vai acontecer

O 2FA (autenticação de dois fatores) adiciona uma segunda barreira após a senha: um código de 6 dígitos que muda a cada 30 segundos, gerado pelo seu celular. Isso significa que mesmo se alguém descobrir sua senha, não consegue entrar sem ter seu celular físico.

Você vai usar o app authenticator (Authy, Google Authenticator, ou 1Password — veja [Apêndice A.4](#a4--instalar-authenticator-app-no-celular)) para escanear um **QR code** mostrado no navegador. A partir daí, sempre que logar, o app web pedirá o código de 6 dígitos que está rotativo no seu celular.

Depois de habilitar, o app web mostra **10 backup codes** — usáveis uma vez cada, no caso de o celular sumir / ser roubado / quebrar. Você vai **anotar esses 10 códigos em papel** e guardar no cofre físico definido nos pré-requisitos.

> ⚠️ **A tela de backup codes aparece UMA VEZ.** Se você fechar / dar refresh / clicar errado antes de anotar, os códigos somem. Tenha o caderno + caneta na mesa **antes** de chegar nesta tela.

#### Como fazer

**1.** Pegue seu celular. Abra o app authenticator (Authy / Google Authenticator / 1Password).

**2.** No app authenticator, encontre o botão **"Adicionar conta"** (geralmente um `+` no canto superior).

**3.** Escolha **"Escanear QR code"**. O app vai pedir permissão da câmera — autorize.

**4.** Aponte a câmera do celular para o QR code mostrado no navegador (a tela `/auth/setup-2fa`). O app reconhece automaticamente.

**5.** O app authenticator agora mostra uma nova entrada:
- **Nome:** "Mktplace da Liberdade (seu@email.com)"
- **Código:** 6 dígitos que mudam a cada 30 segundos (com um pequeno círculo que esvazia indicando quanto tempo falta)

**6.** No navegador, digite o código de 6 dígitos **atual** (o que está visível no celular agora) no campo de confirmação.

**7.** Clique em **Verificar** (ou "Confirmar", "Habilitar 2FA", como for chamado).

#### O que esperar como resposta

A página confirma sucesso e mostra os **10 backup codes** em formato `XXXX-XXXX-XX`:

```
✓ 2FA habilitado com sucesso.

⚠️ ANOTE OS BACKUP CODES ABAIXO. Esta tela NÃO voltará.

  A1B2-C3D4-E5    F6G7-H8I9-J0    K1L2-M3N4-O5
  P6Q7-R8S9-T0    U1V2-W3X4-Y5    Z6A7-B8C9-D0
  E1F2-G3H4-I5    J6K7-L8M9-N0    O1P2-Q3R4-S5
  T6U7-V8W9-X0
```

**8.** Pegue caderno e caneta. **Anote os 10 códigos à mão, em papel.** Não no celular, não em app de notas digital, não em arquivo de texto. Em papel.

**9.** Releia os códigos do papel comparando com a tela, garantindo que copiou corretamente cada caractere.

**10.** Apenas DEPOIS de anotar todos os 10 em papel e conferir, clique no botão **"Já anotei — continuar"** (ou similar). A tela desaparece.

**11.** Guarde o papel no cofre físico decidido nos pré-requisitos. **Lembre onde guardou** — anote isso no documento operacional externo (cofre/wiki interna).

#### O que esperar como resposta (continuação)

Após o "Já anotei — continuar", o app redireciona para:

```
https://app.mktplace.com.br/dashboard
```

Você agora tem acesso completo de master. O fluxo de force-reset / force-2fa terminou.

> 💡 **Você sabe que deu certo quando:** está no dashboard normal do app E tem os 10 backup codes em papel no cofre.

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| `Código TOTP inválido` | O relógio do celular está dessincronizado | **Android:** Configurações → Data e hora → Definir automaticamente. **iOS:** Ajustes → Geral → Data e hora → Automaticamente. Aguardar 30s, tentar de novo com o novo código que apareceu. |
| App authenticator não reconhece o QR code | Câmera com foco ruim, ou QR muito longe / muito perto | Ajustar distância. Aumentar zoom da página web (Ctrl + ou Cmd +) para o QR ficar maior. |
| Tela de backup codes sumiu sem você anotar | Refresh acidental ou cliquei "continuar" cedo demais | **NÃO entre em pânico.** Vá em **Configurações → Segurança → "Regenerar Backup Codes"**. Isso invalida os perdidos e gera 10 novos. Anotar com calma desta vez. |
| Sem app authenticator no celular ainda | Faltou instalar | Apêndice A.4. Instala o Authy ou Google Authenticator e volta. |

#### Não passe para o próximo passo até:

- [ ] Você está no `/dashboard` do app
- [ ] Os 10 backup codes estão anotados em papel
- [ ] O papel está no cofre físico (não no bolso, não na bolsa)
- [ ] Você anotou no documento operacional externo: "Backup codes 2FA Sócio X estão em [local do cofre]"
- [ ] O outro sócio confirma pela chamada que está no mesmo estado (dashboard + backup codes em papel)

---

### Passo 7 — Verificação cruzada entre sócios

**Contexto:** C — App web
**Quem executa:** Ambos em paralelo, comunicando-se na chamada
**Tempo estimado:** 10 minutos

#### O que vai acontecer

Bootstrap só termina quando ambos os sócios validaram o trabalho um do outro. Você vai testar logout + login completo com 2FA, e usar **um** dos seus backup codes (consumindo 1 dos 10) para confirmar que o caminho de recuperação funciona.

Após este passo, cada um tem 9 backup codes restantes. Anote essa contagem no documento operacional.

#### Como fazer

**Sub-passo 7.1 — Logout e relogin com 2FA (ambos, paralelo)**

**1.** Clique em "Sair" / "Logout" no app.

**2.** Você vai para a tela de login.

**3.** Faça login com email + senha definitiva (do Bitwarden, Passo 5).

**4.** O app pede o código TOTP de 6 dígitos.

**5.** Abra o app authenticator no celular, pegue o código atual, digite.

**6.** Submit. Você cai no dashboard novamente.

> 💡 Confirma com o outro sócio na chamada: "Loguei com 2FA, tô no dashboard". O outro responde igual.

**Sub-passo 7.2 — Teste de backup code (ambos, paralelo, consome 1 dos 10)**

**1.** Logout de novo.

**2.** Faça login com email + senha definitiva.

**3.** Na tela de 2FA, procure o link/botão **"Usar backup code"** (ou similar).

**4.** Pegue **um** dos 10 backup codes do papel. Digite no campo (pode digitar com ou sem hífens — o app normaliza).

**5.** Submit. Você cai no dashboard.

**6.** **Risque o código usado no papel** (esse não pode ser reutilizado).

**Sub-passo 7.3 — Conferir contagem de backup codes restantes**

**1.** No dashboard, vá em **Configurações → Segurança**.

**2.** Encontre a linha "Backup codes restantes".

**3.** Deve mostrar **9** (gastou 1 no sub-passo 7.2).

**Sub-passo 7.4 — Confirmar role master**

**1.** Vá em **Painel Admin** (link no menu).

**2.** Acesse **Usuários**.

**3.** Encontre seu próprio email na lista. Confirme:
   - Role: `MASTER`
   - Status: ativo
   - 2FA: habilitado
   - Backup codes: 9

**4.** Comunique pelo chat / chamada: "Sócio X confirma role master + 9 backup codes".

#### O que esperar como resposta

- Login completo (senha + 2FA) funciona em ambos
- Backup code consome 1, sobram 9 — visível na tela de Segurança
- Painel admin mostra ambos os sócios como master ativos com 2FA habilitado

> 💡 **Você sabe que deu certo quando:** ambos os sócios conseguem entrar com 2FA, gastaram 1 backup code com sucesso, e veem o outro na lista de masters no admin.

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| Login normal funciona, mas TOTP rejeita o código | Relógio do celular dessincronizado | Mesma fix do Passo 6: sincronizar relógio do sistema. |
| Backup code é rejeitado | Pode ter digitado errado, ou já usou esse antes | Conferir letra por letra com o papel. Os códigos são case-insensitive mas qualquer typo invalida. Se conferir e ainda rejeitar, problema no app — printar e parar. |
| Contagem mostra menos que 9 backup codes restantes | Pode ter consumido mais de 1 sem perceber | Aceitável se você testou repetidamente. Anotar a contagem real. |
| Sócio aparece com role diferente de master | Bug no INSERT do Passo 3 | **PARE.** Estado inconsistente. NÃO tentar corrigir via UI. Rodar [Cenário: Bootstrap falha no meio](#cenário-bootstrap-falha-no-meio-rollback). |
| Sócio NÃO aparece na lista de usuários | INSERT do Passo 3 não aconteceu para este sócio | **PARE.** Mesmo cenário acima. |

#### Não passe para o próximo passo até:

- [ ] Ambos os sócios logaram com 2FA pelo menos uma vez
- [ ] Ambos gastaram 1 backup code com sucesso (sobram 9 cada)
- [ ] Ambos veem o outro como master ativo no painel admin
- [ ] Documento operacional externo anotado: "Sócio 1 = 9 backup codes restantes. Sócio 2 = 9 backup codes restantes. Data: 2026-05-15."

---

### Passo 8 — Confirmar audit log

**Contexto:** C — App web (painel admin)
**Quem executa:** **Apenas um sócio** (o outro acompanha via screen share)
**Tempo estimado:** 5 minutos

#### O que vai acontecer

O audit log é o "diário de bordo" do sistema — toda ação sensível deixa um registro permanente. Para evidência em auditorias futuras, compliance, e revisões internas, você vai confirmar que o bootstrap deixou os rastros corretos.

#### Como fazer

**1.** No app, vá em **Painel Admin → Audit Logs** (ou "Logs de Auditoria", como for nomeado).

**2.** Filtre por:
   - **Período:** últimas 2 horas
   - **Tipo:** todos (não filtre por tipo)

**3.** Confira a lista. Deve haver os seguintes eventos, todos com timestamp recente:

| Tipo de evento | Sujeito (o usuário afetado) | Ator (quem fez) |
|---|---|---|
| `USER_CREATED` | socio1@dominio-real.com.br | `SYSTEM` (bootstrap-prod) |
| `USER_CREATED` | socio2@dominio-real.com.br | `SYSTEM` |
| `USER_DELETED` | master@mktplace.com | `SYSTEM` (se existia) |
| `USER_DELETED` | admin@mktplace.com | `SYSTEM` (se existia) |
| `PASSWORD_CHANGED` | socio1@... | socio1@... (próprio usuário no Passo 5) |
| `PASSWORD_CHANGED` | socio2@... | socio2@... |
| `2FA_ENABLED` | socio1@... | socio1@... |
| `2FA_ENABLED` | socio2@... | socio2@... |

**4.** Eventos esperados: **8** (ou **6**, se os defaults `master@`/`admin@mktplace.com` não existiam previamente).

#### O que esperar como resposta

Lista do audit log mostra os 6-8 eventos esperados, na ordem cronológica: primeiro os `USER_CREATED`+`USER_DELETED` (do Passo 3, agrupados por timestamp), depois `PASSWORD_CHANGED` (do Passo 5), depois `2FA_ENABLED` (do Passo 6).

#### O que fazer se der errado

| Erro / Anomalia | O que significa | Como resolver |
|---|---|---|
| Algum evento ausente | O sistema de audit log não capturou aquele ponto | **PARE antes de abrir prod ao público.** Sem trilha de auditoria não há compliance. Reportar o que está faltando. |
| Eventos fora de ordem (ex.: `2FA_ENABLED` antes de `PASSWORD_CHANGED` para o mesmo sócio) | Fluxo de force-reset/force-2fa tem bug | Reportar como bug. Pode-se prosseguir, mas anotar no incident log para corrigir antes do go-live. |
| Aparece `USER_CREATED` para email que vocês não esperavam | Alguém INSERT-ou outro usuário no banco | Investigar imediatamente. Conferir se foi durante o bootstrap (improvável) ou se aconteceu antes (mais sério). |

#### Não passe para o próximo passo até:

- [ ] Os 6-8 eventos esperados estão visíveis no audit log
- [ ] Timestamp dos eventos é compatível com a hora do bootstrap (não muito antes nem muito depois)
- [ ] Outro sócio confirmou pela tela compartilhada que viu o mesmo

---

### Passo 9 — Abrir DNS público

**Contexto:** depende da infra escolhida (painel do provedor de cloud / Cloudflare / DNS provider)
**Quem executa:** Sócio que tem acesso ao painel da infra. O outro confirma de uma rede externa.
**Tempo estimado:** 5 minutos (de execução) + até 48 horas (propagação de DNS, geralmente 5-30 minutos)

#### O que vai acontecer

Até agora o app estava "isolado" — acessível apenas via VPN, IP whitelist, ou rede interna. Este passo remove o isolamento e o app passa a receber tráfego público real.

A partir daqui, qualquer pessoa na internet pode chegar em `https://app.mktplace.com.br` (ou o domínio escolhido). Por isso fizemos todo o resto antes — para que NÃO exista master com senha default, sem 2FA, exposto à internet.

#### Como fazer

A operação depende do provedor de DNS / cloud. As três variações mais comuns:

**Variação 1 — Remover regra de firewall que limitava por IP:**
1. Painel do provedor (AWS Security Groups, GCP Firewall, etc.)
2. Localizar a regra que permitia apenas IPs específicos (escritório, casa dos sócios, VPN)
3. Substituir por regra permitindo `0.0.0.0/0` nas portas 80/443

**Variação 2 — Apontar registro DNS para o IP público:**
1. Painel do DNS (Cloudflare, Route 53, registro.br, etc.)
2. Localizar registro tipo `A` para `app.mktplace.com.br`
3. Mudar valor para o IP público do servidor
4. TTL recomendado: 300s (5min) durante o lançamento, sobe depois

**Variação 3 — Cloudflare WAF + DNS proxy:**
1. Cloudflare → DNS
2. Adicionar registro `A` apontando para o IP do servidor
3. Ativar o "proxied" (nuvem laranja) — isso oculta o IP real
4. Em WAF, confirmar que as regras padrão estão ativas

#### O que esperar como resposta

Depois da mudança:

**1.** Aguarde 5-30 minutos para a propagação de DNS.

**2.** O outro sócio, **fora da rede interna** (ex.: usando 4G do celular para tetherar o notebook, ou de uma rede externa), tenta acessar:

```
https://app.mktplace.com.br
```

**3.** Página carrega normalmente — tela de login.

**4.** Não tente logar do 4G. Apenas confirme que a página carrega de fora.

> 💡 **Você sabe que deu certo quando:** o sócio que está em rede externa consegue chegar na tela de login do app.

#### O que fazer se der errado

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| Domínio não resolve (`DNS_PROBE_FINISHED_NXDOMAIN`) | Propagação ainda não terminou | Aguardar mais 30-60 min. Se passou 4h e ainda não resolve, conferir o registro DNS na ferramenta. |
| `502 Bad Gateway` / `504 Gateway Timeout` | DNS resolveu, mas o app não está respondendo no IP exposto | Conferir saúde do serviço (status do PM2/systemd/Docker), logs do app, e se o firewall do servidor permite tráfego nas portas 80/443. |
| `Connection refused` | A porta não está aberta | Conferir Security Group / Firewall do provedor. |
| Certificado SSL inválido / não confiável | HTTPS não está configurado corretamente | Provavelmente certbot/Let's Encrypt não rodou ou expirou. Reissue do certificado. **NÃO** sirva o app em HTTP — fechar de novo e investigar. |

#### Não passe para o próximo passo até:

- [ ] O sócio fora da rede interna confirma acesso à tela de login
- [ ] Certificado HTTPS está válido (cadeado verde no navegador)
- [ ] Nenhuma das duas máquinas dos sócios precisa de VPN ativo para acessar o app

---

### Depois do Passo 9 — Documentação final

O bootstrap está concluído. Antes de fechar a chamada, documentar no arquivo externo (cofre/wiki interna, NÃO no repo):

- ✅ Data e hora exata do bootstrap (timestamp do audit log)
- ✅ Email final de cada sócio
- ✅ Localização exata do cofre físico onde estão os backup codes em papel de cada sócio
- ✅ Quem é fallback de quem (o Sócio 1 recupera Sócio 2, e vice-versa)
- ✅ Próxima data de revisão recomendada: **90 dias** — uma data marcada na agenda dos dois, para confirmar que ambos ainda têm acesso (faz um login completo de verificação).
- ✅ Como cada sócio armazenou a senha definitiva (Bitwarden / 1Password / etc.)

---

## Anatomia do script `bootstrap-prod.ts`

O script ainda **não foi escrito**. Esta seção descreve o que ele DEVE fazer, em prosa e pseudo-código, para servir de especificação na sprint que fechar SER-15 ([Pré-requisitos de código](#pré-requisitos-de-código-ainda-não-implementados)).

### Comportamento esperado

1. **Validação de ambiente:** confirma `NODE_ENV === 'production'`. Se não, aborta com erro explicando que este script só roda em prod (espelho do guard em `seed.ts`).
2. **Conexão:** instancia o PrismaClient e valida que o banco é alcançável e a migration de schema está aplicada. Aborta se a tabela `User` não existir.
3. **Inputs interativos:** pede via prompt (não argv, para evitar histórico bash com hashes):
   - Email do Sócio 1
   - Hash bcrypt do Sócio 1
   - Email do Sócio 2
   - Hash bcrypt do Sócio 2
4. **Validação de inputs:**
   - Emails são válidos sintaticamente.
   - Hashes parecem bcrypt válido (`$2a$12$...` ou `$2b$12$...`, total ~60 chars).
   - Emails dos dois são diferentes entre si.
   - Nenhum dos emails é `master@mktplace.com` ou `admin@mktplace.com` (defaults proibidos).
5. **Resumo + confirmação dupla:** mostra o que vai acontecer e exige que o operador digite literalmente `SIM, EXECUTAR`. Qualquer outra coisa aborta.
6. **Transação atômica:** uma única `prisma.$transaction(async tx => {...})` com:
   - `tx.user.create()` para Sócio 1 com `forcePasswordReset=true`, `force2FASetup=true`, `roleId=<master>`, `legacyRole='MASTER'`.
   - `tx.user.create()` para Sócio 2 com mesmas flags.
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
    { type: 'text',     name: 'email1', message: 'Email do Sócio 1' },
    { type: 'password', name: 'hash1',  message: 'Hash bcrypt do Sócio 1' },
    { type: 'text',     name: 'email2', message: 'Email do Sócio 2' },
    { type: 'password', name: 'hash2',  message: 'Hash bcrypt do Sócio 2' },
  ]);

  // 4. Validação (omitida no pseudo-código)
  validateEmail(inputs.email1);
  validateEmail(inputs.email2);
  validateBcryptHash(inputs.hash1);
  validateBcryptHash(inputs.hash2);
  if (inputs.email1 === inputs.email2) abort('Emails idênticos');
  if (FORBIDDEN_EMAILS.has(inputs.email1) || FORBIDDEN_EMAILS.has(inputs.email2)) {
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
    // CRIT-02: hdAccountIndex é alocado automaticamente pelo Postgres via
    // DEFAULT nextval('user_hd_account_seq'). NÃO passar o campo explicitamente.
    // Masters/sócios são usuários normais neste aspecto — cada um recebe sua
    // carteira pessoal imutável (hdAccountIndex alocado na ordem de criação).
    // Acesso à carteira da plataforma (account 0) é via permissão RBAC, não posse.
    const u1 = await tx.user.create({
      data: {
        email: inputs.email1,
        password: inputs.hash1,
        roleId: masterRole.id,
        legacyRole: 'MASTER',
        forcePasswordReset: true, // schema pendente — SER-15
        force2FASetup: true,      // schema pendente — SER-15
      },
    });
    const u2 = await tx.user.create({
      data: {
        email: inputs.email2,
        password: inputs.hash2,
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
      { type: 'USER_CREATED', subjectId: u1.id, actorId: 'SYSTEM' },
      { type: 'USER_CREATED', subjectId: u2.id, actorId: 'SYSTEM' },
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

- ❌ **Usar SMS como segundo fator.** SMS é vulnerável a SIM swap (atacante convence operadora a transferir seu chip). 2FA por SMS é melhor que nada para usuários comuns, mas para conta master é inaceitável. Use TOTP app (Authy/Google Authenticator) ou chave hardware (YubiKey).

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

1. Pela atomicidade Postgres, nada foi gravado. Verificar com `SELECT COUNT(*) FROM "User" WHERE email IN ('socio1@...', 'socio2@...');` → esperado 0.
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

## Apêndice A — Instalação de ferramentas necessárias

> ⚠️ **Faça este apêndice inteiro pelo menos uma semana antes do dia D.** Acesso SSH em particular (A.3) pode levar dias para resolver se o provedor exigir aprovação manual da chave pública. No dia do bootstrap, todas as ferramentas precisam estar funcionando.

### A.1 — Instalar OpenSSL (gerador de senha aleatória)

**O que é:** OpenSSL é uma biblioteca/programa de criptografia. Aqui usamos só uma função pequena dele (`rand`) para gerar bytes aleatórios criptograficamente seguros.

#### Windows
1. Baixar **Git for Windows**: https://git-scm.com/download/win
2. Executar o instalador. **Manter todas as opções padrão**. Em particular, deixar marcado "Git Bash Here" e "Use Git from the Windows Command Prompt".
3. Após instalar, fechar e reabrir o terminal.
4. **Importante:** use o **Git Bash** (não o `cmd` nem o PowerShell normal). Para abrir: Iniciar → digitar "Git Bash" → Enter.

#### Mac
OpenSSL já vem instalado nativamente. Nenhuma instalação necessária.

> 💡 Versão recente do Mac (Ventura+) usa LibreSSL em vez de OpenSSL. Os comandos básicos usados aqui funcionam igual.

#### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install openssl
```

#### Verificar instalação
Em qualquer sistema, abrir terminal e rodar:
```bash
openssl version
```

Saída esperada: algo como `OpenSSL 3.0.7` ou `LibreSSL 3.3.6`. Se aparecer "command not found", a instalação falhou — repita.

---

### A.2 — Instalar Node.js (para gerar hash bcrypt)

**O que é:** Node.js é um runtime que executa JavaScript fora do navegador. Aqui usamos só para rodar um comando de uma linha que chama a biblioteca `bcryptjs` para gerar o hash.

#### Todos os sistemas
1. Acessar https://nodejs.org/
2. Baixar a versão **LTS** (botão verde à esquerda). LTS = Long-Term Support, mais estável.
3. Executar o instalador. **Manter todas as opções padrão**. Em particular, deixar marcado "Automatically install necessary tools" no Windows.
4. Após instalar, fechar e reabrir o terminal.

#### Verificar instalação
```bash
node --version
npm --version
```

Saída esperada:
```
v20.10.0    (ou versão similar; qualquer 18+ serve)
10.2.3      (versão do npm que veio junto)
```

#### Instalar bcryptjs globalmente (atalho)
Para evitar erro de "Cannot find module 'bcryptjs'" no Passo 2:
```bash
npm install -g bcryptjs
```

Se aparecer "permission denied" no Mac/Linux, prefixar com `sudo`:
```bash
sudo npm install -g bcryptjs
```

> 💡 Alternativa sem instalação global: rodar o comando do Passo 2 de dentro da pasta `apps/api/` do projeto (onde bcryptjs já está como dependência).

---

### A.3 — Configurar acesso SSH ao servidor de produção

> ⚠️ **Esta é a etapa que mais demora.** Fazer **pelo menos uma semana antes** do dia D.

**O que é SSH:** Secure Shell. Permite abrir um terminal **dentro** de outro computador, pela internet, de forma encriptada. É como o TeamViewer / AnyDesk, mas via linha de comando — apenas texto, sem interface gráfica.

**Modelo de autenticação:** ao invés de senha, SSH usa um **par de chaves** — uma pública (que você compartilha com o servidor) e uma privada (que NUNCA sai do seu PC). Quem tem a chave privada prova quem é.

#### Passo A.3.1 — Gerar par de chaves SSH no seu PC

**1.** Abrir terminal (Git Bash no Windows, Terminal no Mac, bash no Linux).

**2.** Rodar:
```bash
ssh-keygen -t ed25519 -C "seu.email@dominio.com"
```

Substituir pelo seu email. O `-t ed25519` escolhe o algoritmo (moderno e seguro), o `-C` adiciona um comentário (seu email, para identificar a chave depois).

**3.** Quando perguntar "Enter file in which to save the key", **apertar Enter** para aceitar o padrão (`~/.ssh/id_ed25519`).

**4.** Quando perguntar "Enter passphrase":
- **Recomendado:** digitar uma senha forte (passphrase) — protege a chave caso roubem seu PC.
- **Mínimo:** apertar Enter duas vezes (passphrase vazia — chave fica protegida só pelo controle do seu PC).

> ⚠️ Se digitar passphrase, **salvar no seu gerenciador de senha**. Sem ela, a chave fica inutilizável.

**5.** Apertar Enter para confirmar a passphrase.

#### Passo A.3.2 — Pegar a chave pública

```bash
cat ~/.ssh/id_ed25519.pub
```

Saída: uma única linha começando com `ssh-ed25519 AAAA...`, terminando com seu email.

**Copiar essa linha inteira.** Essa é a sua chave pública. Compartilhar livremente — não é segredo.

#### Passo A.3.3 — Compartilhar a chave pública com o provedor

Cada provedor de cloud tem um lugar diferente para colar isso:

- **AWS:** EC2 → Key Pairs → Import Key Pair → Colar
- **GCP:** Compute Engine → Metadata → SSH Keys → Add → Colar
- **DigitalOcean / Vultr / Linode:** Settings → Security → SSH Keys → Add → Colar
- **Servidor próprio (VPS):** sysadmin precisa adicionar manualmente no `/home/seu-usuario/.ssh/authorized_keys` do servidor

#### Passo A.3.4 — Testar a conexão

```bash
ssh -i ~/.ssh/id_ed25519 usuario@ip-do-servidor
```

Substituir `usuario` pelo seu nome no servidor e `ip-do-servidor` pelo IP real.

**Primeira vez:** vai perguntar "Are you sure you want to continue connecting?" — digitar `yes` e Enter.

**Sucesso:** aparece o prompt do servidor (`usuario@hostname:~$`). Você está dentro. Digite `exit` para sair.

**Falha comum:** `Permission denied (publickey)` — sua chave pública não foi instalada no servidor corretamente. Verificar com quem provisionou.

---

### A.4 — Instalar authenticator app no celular

**O que é:** app que gera os códigos TOTP (Time-based One-Time Password) de 6 dígitos que rotacionam a cada 30s. É o seu "segundo fator" após a senha.

#### Opções recomendadas (em ordem de preferência)

**1. Authy** (Twilio) — **recomendado**
- Sincroniza entre dispositivos (você pode ter no celular + notebook + tablet).
- Backup encriptado na nuvem do Twilio (recupera se perder o celular).
- Free.
- Apps: iOS (App Store) e Android (Play Store) e Desktop.

**2. Google Authenticator**
- Simples, sem nuvem.
- Backup só com QR code de exportação (você decide migrar quando troca de celular).
- Free.

**3. 1Password** (se você já usa 1Password como gerenciador)
- Integra TOTP dentro do gerenciador.
- Vantagem: tudo em um lugar. **Desvantagem:** se 1Password vaza, vaza tudo. Para conta master, considere separar (TOTP em Authy / GA, senhas em 1Password).

#### ❌ NÃO usar
- **SMS como 2FA.** Vulnerável a SIM swap (atacante convence sua operadora a transferir seu número para um chip dele). Já levou a roubo de contas master de bancos, exchanges, etc.
- **Email como 2FA.** Defeats the purpose — se o atacante já tem sua senha, provavelmente já tem seu email também.

#### Setup

**1.** Instalar o app escolhido na loja oficial (App Store / Play Store). Cuidado com falsificações.

**2.** Abrir o app. Geralmente pede um PIN/biometria de proteção — configurar.

**3.** O app está pronto. Você vai adicionar a primeira conta (a conta master do app) no Passo 6 do runbook, escaneando o QR code.

#### Verificação

Antes do dia D, confirmar que você consegue:
- Abrir o app
- Adicionar uma conta de teste (use o GitHub 2FA ou similar pra testar, depois remove)
- Ler o código de 6 dígitos rotativo

---

## Apêndice B — Glossário expandido

Cada termo abaixo aparece em algum momento neste runbook. Definição + analogia + onde aparece.

### 2FA / TOTP

- **O que é:** "Two-Factor Authentication" (2FA) — autenticação de dois fatores. Você precisa de DUAS coisas pra logar: a senha (algo que você sabe) E um código que muda (algo que você tem — neste caso seu celular). TOTP é o algoritmo específico que gera código baseado em tempo (`T = Time-based`).
- **Analogia:** entrar em um cofre bancário. Não basta a senha do cofre — o gerente também precisa girar uma chave física que só ele tem. Sem as duas coisas, não abre.
- **Onde aparece:** Passo 6 (habilitar 2FA pela primeira vez), Passo 7 (usar 2FA no login), Apêndice A.4 (instalar app authenticator).

### bcrypt

- **O que é:** algoritmo que transforma uma senha em uma sequência "embaralhada" (hash) que não pode ser revertida. O processo é intencionalmente lento (~200ms por hash) para dificultar ataques de força bruta. "12 rounds" significa que o algoritmo repete um cálculo 2^12 = 4096 vezes.
- **Analogia:** imagine triturar um papel em uma trituradora de papel **muito boa** (que demora 2 segundos por papel). Você pode comparar dois papéis triturados pra ver se eram iguais (gerando outro com a mesma senha), mas não consegue reconstruir o original. E o "demorar 2 segundos" é proposital — se um atacante tem 1 milhão de senhas pra testar, leva 23 dias só pra terminar de testar.
- **Onde aparece:** Passo 2 (gerar hash da senha), Passo 3 (script insere o hash no banco), Passo 5 (app gera hash da nova senha definitiva).

### hash

- **O que é:** uma "impressão digital" de qualquer dado. Texto, arquivo, senha — qualquer coisa pode ter um hash. A função hash sempre gera saída do mesmo tamanho (para bcrypt-12, sempre ~60 caracteres). Dois dados iguais geram o mesmo hash; um único caractere mudado gera um hash completamente diferente.
- **Analogia:** assinatura cardíaca. Dois eletrocardiogramas da mesma pessoa em momentos diferentes batem (são compatíveis); de pessoas diferentes, nunca batem. Mas você não pode reconstruir a pessoa a partir do eletrocardiograma.
- **Onde aparece:** bcrypt é uma forma específica de hash. Hash também aparece no audit log (cada evento tem um hash do conteúdo para detecção de adulteração).

### SSH

- **O que é:** "Secure Shell" — um protocolo de rede que permite executar comandos em um computador remoto através de um canal criptografado. Você digita no seu PC, o comando viaja pela internet protegido, executa no servidor, e a resposta volta para sua tela.
- **Analogia:** como o TeamViewer ou AnyDesk, mas só texto (sem mouse, sem imagens). Você vê o terminal do servidor como se fosse seu, e ninguém no meio do caminho consegue bisbilhotar o que você digita ou o que aparece na tela.
- **Onde aparece:** Passo 3 (conectar ao servidor de produção), Apêndice A.3 (configurar acesso).

### SQL

- **O que é:** "Structured Query Language" — linguagem para conversar com banco de dados relacional (Postgres, MySQL, SQLite, etc.). Você escreve frases que descrevem o que quer (`SELECT name FROM users WHERE id = 1`) e o banco responde com os dados.
- **Analogia:** é como dar instruções para um arquivista numa biblioteca enorme. Você não anda nas estantes — você fala "me traga todos os livros de João da seção história, organizados por data". O arquivista faz o trabalho e te entrega a pilha.
- **Onde aparece:** Passo 3 (o script bootstrap-prod executa SQL para criar usuários e apagar defaults). Plano de recuperação (consultas manuais via `psql`).

### Transação atômica

- **O que é:** uma sequência de operações no banco que **ou acontece toda inteira, ou nenhuma parte dela acontece**. Não existe "metade feita". Em SQL, é o bloco `BEGIN ... COMMIT`. Se algo der errado no meio, o banco faz `ROLLBACK` automaticamente e volta tudo ao estado anterior.
- **Analogia:** transferência bancária entre duas contas. O dinheiro **tem** que sair da conta A E entrar na conta B. Se a luz cair entre as duas operações, o sistema não pode parar com "saiu de A, não entrou em B" — isso seria perder dinheiro. Ou tudo ou nada.
- **Onde aparece:** Passo 3 (INSERT sócios + DELETE defaults é UMA transação — se qualquer parte falhar, nada é gravado). Princípio de segurança 5.

### SPOF (Single Point of Failure)

- **O que é:** "Único Ponto de Falha" — um componente que, se quebrar, derruba o sistema inteiro. Servidor único, único administrador, único banco sem réplica, chave única sem backup.
- **Analogia:** se uma ponte é o único caminho para uma ilha, ela é SPOF da ilha. Caiu a ponte, a ilha fica isolada. Solução: construir uma segunda ponte (ou ter barco de backup).
- **Onde aparece:** Princípio de segurança 2 (dois masters independentes são a solução para evitar que UM sócio se torne SPOF de acesso administrativo). Plano de recuperação (cenário single-master operation).

### Audit log

- **O que é:** "Log de auditoria" — registro permanente, **somente-leitura**, de toda ação sensível no sistema. Quem fez, o quê, em quem, e quando. Não pode ser apagado nem editado pelo próprio app — só visualizado.
- **Analogia:** o livro de visitas de um cofre bancário. Toda vez que alguém abre, fica registrado: nome, data, hora, motivo. Auditor pode ler, mas ninguém pode rasgar páginas.
- **Onde aparece:** Passo 8 (conferir que os 8 eventos esperados foram registrados). Princípio implícito em todos os princípios de segurança.

### Bootstrap

- **O que é:** "puxar a bota" (do inglês "pull yourself up by your bootstraps") — a primeira execução, o ato de criar algo do zero. Em sistemas, é o procedimento inicial que coloca um ambiente em estado "pronto pra uso", a partir do nada.
- **Analogia:** "ligar o sistema pela primeira vez". É como abrir uma loja nova: você precisa decidir o nome, contratar funcionários, definir os primeiros produtos. Depois que está aberta, é só operar — bootstrap é só uma vez.
- **Onde aparece:** o título deste runbook, o nome do script (`bootstrap-prod.ts`). Toda a sua razão de existir.

### Atomicidade

- **O que é:** propriedade de "ser indivisível" — não pode ser quebrado em partes intermediárias. Em banco de dados, é a "A" do ACID (Atomicity, Consistency, Isolation, Durability).
- **Analogia:** acender uma luz. Ou ela está acesa, ou apagada — não existe "meio acesa" como estado válido permanente. (Pode estar piscando, mas isso é uma sequência rápida de "acesa" e "apagada" — cada estado individual é binário.)
- **Onde aparece:** Princípio 5, Passo 3, Anatomia do script. É o que torna o INSERT+DELETE seguro em conjunto.

### `forcePasswordReset` e `force2FASetup`

- **O que são:** flags booleanas no model `User` (campos a serem adicionados — veja Pré-requisitos de código). Quando `true`, fazem o middleware do app **redirecionar TODA requisição autenticada** para a tela de setup correspondente. O usuário não consegue navegar para nenhuma outra rota até concluir o setup, momento em que a flag vira `false`.
- **Analogia:** como aquele aviso "você precisa atualizar seus dados antes de continuar" que alguns sistemas mostram após login. Mas mais rigoroso: você nem chega na home — toda URL leva pra `/setup`.
- **Onde aparece:** Passos 4-6 (o app força a sequência setup-password → setup-2fa → dashboard porque essas flags vêm `true` direto do INSERT do bootstrap). Princípio 4.

### TLS

- **O que é:** "Transport Layer Security" — protocolo que cripta a comunicação entre seu navegador e o servidor. É o que faz o cadeado verde aparecer e o "https" em vez de "http". Versão antiga era chamada SSL.
- **Analogia:** envelope lacrado pelos correios. Sem TLS, qualquer um no caminho (provedor de internet, roteador público, etc.) consegue ler o que você digita. Com TLS, só o destinatário pode abrir.
- **Onde aparece:** Passo 9 (confirmar cadeado verde antes de abrir DNS). Princípio implícito: comunicação master só por canais com TLS válido.
