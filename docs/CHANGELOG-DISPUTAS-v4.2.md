# Changelog - Sistema de Disputas v4.2

**Data:** 2026-02-22
**Branch:** `feature/v4.2-buy-swap`
**Commit:** `6997695`

---

## Resumo

Tres melhorias no sistema de disputas, todas 100% frontend (nenhuma mudanca no backend).

---

## 1. Correcao de Anexos (Imagens e PDFs)

**Problema:** Arquivos enviados nas disputas eram armazenados como base64 data URLs no banco. O componente renderizava `<a href={dataUrl} target="_blank">`, mas navegadores bloqueiam data URLs grandes em novas abas por restricoes de seguranca. Resultado: nem usuarios nem admins conseguiam abrir ou baixar anexos.

**Solucao:** Converter base64 para `Blob` + `URL.createObjectURL` no momento do clique.

**Arquivo:** `apps/web/components/DisputeMessageThread.tsx`

**Funcoes adicionadas:**
- `dataUrlToBlob(dataUrl)` - Converte data URL base64 para objeto Blob
- `downloadBase64File(dataUrl, filename)` - Cria link temporario com atributo `download`, clica e revoga
- `openBase64File(dataUrl)` - Cria Blob URL e abre com `window.open`

**Comportamento por tipo de arquivo:**

| Tipo | Preview | Abrir | Baixar |
|------|---------|-------|--------|
| Imagem | `<img src={dataUrl}>` inline | Click na imagem → `openBase64File` | Botao "Baixar imagem" |
| PDF | Icone PDF + nome | Botao "Abrir" → `openBase64File` | Botao "Baixar" |
| Outros | - | - | Botao "Anexo N - Baixar" |

---

## 2. Aba "Chat com Todos" para Staff (Broadcast)

**Problema:** Admin/Master tinha abas privadas por parte (Vendedor/Comprador), mas nao tinha como enviar mensagens de conclusao visiveis para ambas as partes simultaneamente.

**Solucao:** Nova aba "Chat com Todos" com valor especial `activeTab = 'BROADCAST'`.

**Arquivo:** `apps/web/app/disputes/[disputeId]/page.tsx`

**Detalhes:**
- Aba posicionada antes das abas individuais, com estilo amber diferenciado
- Aba padrao ao abrir disputa como staff
- Texto auxiliar: "Mensagens enviadas aqui serao visiveis para ambas as partes"
- Filtro: mostra TODAS as mensagens (visao completa do caso)
- Envio: `visibleTo = undefined` → backend salva `visibleTo = null` → ambas as partes veem

**Logica de visibleTo:**
```
activeTab === 'BROADCAST' → visibleTo = undefined (broadcast para todos)
activeTab === partyId     → visibleTo = partyId (privado para aquela parte)
```

**Infraestrutura backend ja existente (nao modificada):**
- `visibleTo: null` + `isAdminMessage: true` = mensagem visivel para ambas as partes
- Backend filtra para usuarios normais: msgs proprias + admin msgs com `visibleTo === null` ou `visibleTo === seuId`

---

## 3. Reordenacao do Layout (Resolver Disputa)

**Problema:** O card "Resolver Disputa" ficava acima do chat, quebrando o fluxo natural de avaliacao.

**Solucao:** Movido para depois do chat. Fluxo agora:
1. Informacoes da disputa (header, partes, descricao, evidencias)
2. Canais de comunicacao (chat broadcast + abas privadas)
3. Resolver disputa (decisao final)

---

## 4. Badge de Resultado (Vencedor/Perdedor)

**Problema:** Apos resolucao, o usuario via apenas "Resolvida - Favor do Comprador/Vendedor" sem clareza se ele era o vencedor ou perdedor.

**Solucao:** Badge contextual dentro do card de resolucao.

**Arquivo:** `apps/web/app/disputes/[disputeId]/page.tsx`

**Comportamento:**
- **Vencedor:** Badge verde - "A disputa foi decidida a seu favor."
- **Perdedor:** Badge vermelho - "A disputa foi decidida a favor da outra parte."
- **Staff:** Nao ve o badge (ja tem visao administrativa completa)

**Logica:**
```
RESOLVED_BUYER → vencedor = buyer.id
RESOLVED_SELLER → vencedor = seller.id
currentUserId === vencedor ? badge verde : badge vermelho
```

---

## Arquivos Modificados

| Arquivo | Mudancas |
|---------|----------|
| `apps/web/components/DisputeMessageThread.tsx` | Helpers blob, refatoracao de renderizacao de anexos |
| `apps/web/app/disputes/[disputeId]/page.tsx` | Aba broadcast, reordenacao layout, badge resultado |

---

## Verificacao

### Anexos
- [x] Enviar imagem → preview inline aparece
- [x] Clicar na imagem → abre em nova aba via Blob URL
- [x] Botao "Baixar imagem" → baixa o arquivo
- [x] Enviar PDF → icone PDF aparece com botoes
- [x] Botao "Abrir" no PDF → abre em nova aba
- [x] Botao "Baixar" no PDF → baixa o arquivo

### Aba Broadcast
- [x] Staff ve 3 abas: "Chat com Todos", "Vendedor", "Comprador"
- [x] Aba broadcast mostra todas as mensagens
- [x] Mensagem enviada no broadcast chega para ambas as partes
- [x] Abas individuais mantém chat privado

### Layout
- [x] Card "Resolver Disputa" aparece apos o chat

### Badge Resultado
- [x] Vencedor ve badge verde
- [x] Perdedor ve badge vermelho
- [x] Staff nao ve badge
