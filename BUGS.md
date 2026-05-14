# Bugs Conhecidos - Mktplace da Liberdade

Este arquivo lista bugs críticos conhecidos, status atual e planos de correção.

**Última Atualização**: 2025-11-01

---

## 🟢 Status: Nenhum Bug Crítico Ativo

Todos os bugs críticos identificados foram resolvidos na versão 0.3.12:

### ✅ Resolvidos Recentemente (v0.3.12 - 2025-11-01)

#### 1. ⭐ Erro ao Enviar Avaliação de Transação
- **Severidade**: Alta
- **Sintoma**: Erro 400 "Dados inválidos" ao submeter avaliação
- **Causa**: Backend validava ratings como inteiros estritos, frontend enviava floats
- **Resolução**: Aplicado `Math.round()` em todos ratings antes do envio
- **Arquivo**: `apps/web/app/orders/[orderId]/page.tsx:484-493`
- **Status**: ✅ Resolvido

#### 2. 🛠️ Erro ao Cancelar Pedido
- **Severidade**: Crítica
- **Sintoma**: "Unknown argument cancelledAt" ao tentar cancelar pedido
- **Causa**: Campo `cancelledAt` usado no código mas não existia no schema
- **Resolução**: Adicionado campo ao schema Order e atualizado banco de dados
- **Arquivo**: `apps/api/prisma/schema.prisma:195`
- **Status**: ✅ Resolvido

---

## 🟡 Bugs Menores / Melhorias Futuras

Nenhum bug menor identificado no momento.

---

## 📋 Histórico de Bugs Resolvidos

### v0.3.11 (2025-11-01)
- ✅ Modal de avaliação reaparecendo após clicar em cancelar
  - **Solução**: Adicionado localStorage para rastrear quando usuário declina avaliar
  - **Arquivo**: `apps/web/app/orders/[orderId]/page.tsx:191-193, 1207-1213`

- ✅ Mensagens de chat sendo deletadas ao pedido voltar para PENDING
  - **Solução**: Implementado sistema completo de arquivamento com retenção de 1 ano
  - **Arquivos**: Multiple (ver CHANGELOG.md v0.3.11)

### v0.3.10 e anteriores
- Ver histórico completo em CHANGELOG.md

---

## 🔍 Como Reportar Bugs

Se você encontrar um bug:

1. **Verifique** se já não está listado aqui
2. **Documente**:
   - Passos para reproduzir
   - Comportamento esperado vs observado
   - Screenshots/logs de erro
   - Ambiente (browser, SO, etc.)
3. **Reporte** ao time de desenvolvimento

---

## 🎯 Prioridades de Correção

**Severidade**:
- 🔴 **Crítica**: Impede funcionalidade principal, requer correção imediata
- 🟡 **Alta**: Afeta experiência do usuário, corrigir em próxima release
- 🟢 **Média**: Melhorias, correção quando possível
- ⚪ **Baixa**: Estético/minor, backlog

**Status Atual**: 🟢 Sistema estável, nenhum bug crítico ou de alta prioridade pendente.
