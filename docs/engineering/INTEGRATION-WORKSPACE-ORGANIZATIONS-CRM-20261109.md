# Integração consolidada — Workspace, Organizações e CRM (2026-11-09)

**Estado:** candidate branch para revisão e CI; **não é release nem homologação operacional**. Nenhum merge em main, migração de tenant ativo, modificação de OpenFGA produtivo ou deploy está autorizado por este documento.

## 1. Branch e procedência

- Base de código funcional: `feat/whatsapp-mvp-closure-20261104` (PR #17), HEAD base original `cbafa5eea48f3bf37a40b8386fa4532d6f7eaa0e`.
- Frontend integrado por ancestralidade: PR #18, navegação contextual Inbox e Inspector compacto.
- Fundação e isolamento parcial, todos por ancestralidade linear: PR #20 (Organização/Unidade/Workspace), PR #23 (guard SQL uma org/workspace), PR #24 (ownership e backfill CRM/Inbox/WhatsApp), PR #25 (entrada HTTP CRM protegida), PR #26 (SQL CRM parametrizado por owner).
- Documentação estratégica selecionada de PR #19: cinco arquivos PRD/ADR/Product Gate/WBS copiados como **propostas**, sem código de funis. A ADR de conta foi reconciliada com a decisão de terminologia: **Unidade física** e **Site de publicação digital futuro**.
- Branch consolidada: `integration/workspace-org-crm-c2-20261109`. A única PR de integração desta branch deve ter como base a **branch funcional da PR #17**, e **não** a `main` atual, que contém a governança mas não a árvore de aplicações.
- Os PRs de origem são registros históricos de implementação e revisão. Não se deve fazer merges individuais em ordem divergente depois de integrar a branch consolidada.

## 2. Recursos realmente disponíveis no candidato

| Capacidade | Evidência no código | Limite de release |
| --- | --- | --- |
| Navegação Inbox/Workspace | PR #18 | Frontend não prova isolamento entre workspaces |
| Organização, Unidade física e Workspace | `modules/organizations`, PR #20 | Só bootstrap de contexto padrão; não há gestão multi-org |
| Guard físico para legado | `002_legacy_single_context_gate.sql`, PR #23 | **Impedir 2ª org/workspace** continua obrigatório |
| Owner e backfill por tenant | `003_legacy_ownership.sql`, PR #24 | Campos legados ainda podem ser NULL antes do backfill |
| CRM HTTP com contexto default autorizado | `CrmDefaultContextGuard`, PR #25 | Exige contexto default, membership e novo recurso FGA `crm:context/read` |
| CRM SQL org-scoped | `PgCrmRepository`, `PgCrmExtras`, PR #26 | Chamadas internas legadas sem owner ainda podem usar tenant-only; apenas a entrada HTTP passa pelo guard |
| Gestão de Atendimentos, Funnels, Templates | PRD/ADR/WBS da PR #19 | **Proposta, não implementado**, Product Gate pendente |
| Inbox, SSE e Whatsmeow org/workspace-scoped | Pendente — #21 | Impede a retirada da trava de banco e habilitação de multi-org |

## 3. Evidência e verificação obrigatória

O HEAD da PR #26 (`0da7e84a62210660ab83ce698ca0e8d8ddfc13f2`) teve 19 checks de CI aprovados, nenhuma falha e um job condicional ignorado. Em PostgreSQL descartável, teste A/B de duas organizações no **mesmo tenant** verifica filtros SQL de CRM, IDs estrangeiros, anotações, empregados, identidades, vínculos e CSV. Esse cenário remove índices 002 **apenas dentro de transação descartável**; o produto continua com o bloqueio.

A nova PR consolidada precisa passar, no próprio commit final:
1. Testes Core CRM, Core Host e Organizations PostgreSQL (aplicação de migrations duas vezes e backfill idempotente).
2. Typecheck, build da imagem Core Host, Whatsmeow, WhatsApp e regressão da Inbox.
3. Build/testes da UI de Workspace, CI de infraestrutura e integração real Keycloak/OpenFGA/OpenBao.
4. Comparação do diff com os commits esperados da cadeia, sem perda de arquivos, importações de segredos ou mudança acidental no ambiente operacional.

**CI verde não substitui um deploy de homologação**, backup/restore, verificação de grants FGA ou testes negativos de conversas/SSE de duas organizações.

## 4. Gates de ativação e reversão

**Antes de qualquer deploy planejado em DevServer01**, exigir revisão da PR de integração e da dependência PR #17, baseline de backup restaurável, avaliação de migrations reais e rollback documentado. A mudança de código do CRM exige que as migrações Organization 001/002/003 estejam aplicadas, que o tenant tenha sido inicializado por ator confiável e que o backfill tenha gerado auditoria. Provisionar explicitamente a permissão FGA `crm:context/read` aos usuários autorizados **antes** de trocar a imagem do Host; caso contrário ocorre lockout com 403. Medir autorização positiva/negativa e manter a imagem anterior disponível para rollback.

**Proibições atuais**: não remover `platform_legacy_single_organization` ou `platform_legacy_single_workspace`; não permitir criar segunda organização/workspace; não executar migrations na base ativa sem plano de backup; não alterar rotas de Whatsmeow nem enviar mensagens reais; não implantar código parcial da cadeia em produção.

**Pendências após a consolidação**: #21 Stage C2b/C3 (chamadas internas CRM sem owner, regras de unicidade, Inbox/Whatsmeow/SSE, sharing por workspace) e #22 (administração multi-org), além do fluxo formal de merge da base funcional e aprovação de Product Gate para funis.

## 5. Regras de governança

A nova PR única substitui a pilha de PRs #18, #20, #23, #24, #25 e #26 **para revisão futura**, mas não faz merge delas automaticamente. A PR #19 registra a origem das propostas, importadas nesta branch para alinhar documentação com implementação. As issues #21 e #22 continuam abertas. Marcar PRs originais como substituídas só após confirmar que o snapshot integrado está verde e revisar diferenças com os proprietários.
