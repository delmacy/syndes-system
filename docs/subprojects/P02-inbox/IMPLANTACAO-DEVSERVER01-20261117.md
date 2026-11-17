# P02 Inbox — Deploy DevServer01 · 17/11/2026

> **Implantação verificada em ambiente de desenvolvimento**, 17/11/2026 08:32 (America/Sao_Paulo). Código e Docker image a partir do commit **`412666563ba64a037e4ac85ba16b007442fbc47a`**. **Não é homologação Product Gate e não é implantação em produção.**

## 1 · O que foi entregue

| Item | Evidência e resultado |
|---|---|
| Core Host ativo | `syndes/core-host:inbox-assign-4126665`, substituindo `syndes/core-host:org-scope-8e2fb5d-20261109` |
| Serviço | `syndes-core-host-whatsapp-v2`, o backend que recebe o tráfego interno `/v1/` e `/modules/`; roteamento Traefik/escopo Tailnet e prioridade 110 preservados |
| Código | P02-ASSIGN-01 incluído no build; bytecode JavaScript contém a validação SQL `FOR NO KEY UPDATE OF c FOR SHARE OF o,w,om,wm` |
| Workspace e gateway WA | Contêineres e respectivas imagens mantidos; não houve deploy do frontend ou gateway |
| Estado do dispatch | `WHATSAPP_DISPATCH_ENABLED=true` **preservado**; canário usou `false` apenas para evitar processamento duplicado |
| Multiorganização | `SYNDES_MULTI_ORG_ENABLED=false`, preservando os índices físicos 002 |
| Canário | Nova imagem executada sem porta pública: `/readyz=200`, Inbox anônimo `401`, depois **parado** |
| Cutover | `activate-release.sh` concluído com `CUTOVER_VERIFIED`, sem executar rollback |
| Verificação posterior | Imagem correta em `running`, 0 restarts, `/readyz=200`, gateway/workspace em `running`, canário `exited` |

## 2 · Validações reais, somente leitura

- Tenant DB: **98 conversas**, **1 atribuída**; a única atribuição foi classificada como `eligible_by_membership`. Nenhum `assigned_to` foi atualizado.
- P04: duas travas físicas `platform_legacy_single_organization` e `platform_legacy_single_workspace` presentes; um recibo de backfill identificado.
- OpenBao + tenant credential provider + Core Kernel + OpenFGA reais no Core Host: resolução de tenant, organização e workspace **PASS**. Snapshot lido: 98 conversas, uma conta WhatsApp e duas pessoas CRM.
- O responsável já atribuído possui Control Plane tenant membership ativa e grants OpenFGA reais para `inbox:conversations/read`, `inbox:messages/write` e `inbox:assignment/write` (**ALLOW**). Essa verificação foi realizada diretamente no provider, **não** pelo endpoint de atribuição.
- Rotas anônimas verificadas após troca: `/readyz` = 200; CRM, Inbox, WhatsApp e Organizations = 401.
- **Não foram executadas migrations, backfill, saneamento, provisionamento de grants, updates em dados ou envio de mensagens de teste.** A aplicação foi reiniciada apenas via Compose no Core Host correto.

## 3 · CI que autorizou o candidato

| Evidência | Resultado |
|---|---|
| [Mainline CI `4126665`](https://github.com/delmacy/syndes-system/actions/runs/43968879886) | **SUCCESS** |
| [Docs/Pages `4126665`](https://github.com/delmacy/syndes-system/actions/runs/43968879835) | **SUCCESS** |
| [P02-ASSIGN-02 PG+FGA](https://github.com/delmacy/syndes-system/actions/runs/43968388949) | 35 unitários Inbox, 9 Host HTTP, PG preflight e 5 testes OpenFGA descartável **PASS** |
| Smoke real DevServer01 | Canário e Core ativo aprovados, sem JWT autenticado via navegador |

## 4 · Rollback disponível

O deploy foi produzido de uma worktree **limpa e destacada**, sem alterar os arquivos locais do frontend. Artefatos de deploy no próprio DevServer01:

- Release: `/home/delmacy/syndes-releases/inbox-assignment-4126665/`
- Imagem anterior, preservada: `syndes/core-host:org-scope-8e2fb5d-20261109`
- Script: `bash /home/delmacy/syndes-releases/inbox-assignment-4126665/rollback-to-previous.sh`

O rollback recoloca somente a imagem anterior do Core Host e verifica readiness. **O script foi validado sintaticamente e preparado, mas não foi executado como reversão real neste deploy.** Não há mudança de schema para reverter.

## 5 · Limites e próximos gates

**DEPLOY DEV PASS não equivale a IAM completo ou Product Gate.** O SQL do P02 exige membership P04 ativa `admin/editor` no workspace e na organização, mas **não executa grant OpenFGA individual do destinatário no momento de cada nova atribuição**. A verificação do único responsável existente não cobre futuros destinatários.

Permanecem pendentes, por prioridade:

1. **G2 — autorização individual do destinatário**: definir contrato de escopo/recurso com C04 e integrá-lo fail-closed à atribuição, cobrindo revogação/concorrência.
2. **Keycloak + HTTP autenticado**: login JWT real e operação completa de Inbox com navegador e cenários de negação.
3. **G3 — política de atribuições legadas**: inventário por tenant e decisão de saneamento antes de qualquer mudança em massa. No snapshot atual não houve atribuição inválida na única conversa atribuída, mas isso não equivale a plano global.
4. **G5 — ensaio de rollback e Product Gate**: restauração controlada e aceitação do fluxo ponta a ponta de atendimento/WhatsApp.

**Não aumentar o status do P02 para HOMOLOGADO.** O deploy ocorreu no ambiente de desenvolvimento existente, preservando os limites de escopo e sem ativar mudanças adicionais.
