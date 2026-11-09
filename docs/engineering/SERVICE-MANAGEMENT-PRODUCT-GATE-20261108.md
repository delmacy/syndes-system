# Product Gate técnico — Gestão de Atendimentos / Criador de Funis

**Estado:** Fase 0 auditada; **aprovação de produto pendente**. Este documento não autoriza merge, deploy ou expansão do MVP original.
**Auditoria:** 2026-11-08 (America/Sao_Paulo).
**Escopo de evidência:** repositório GitHub, sem inspeção direta do estado de containers, banco ou arquivos não versionados no DevServer01.

## 1. Baseline verificada

| Referência | Estado observado | Consequência |
| --- | --- | --- |
| `main` | `fb3e52502718a18d7062119533d2598a5b907c88`; árvore de governança/documentos, sem Core Host/CRM/Inbox compiláveis | **Não abrir o primeiro PR de código sobre a main atual.** |
| PR #17 | aberta, **draft**; `feat/whatsapp-mvp-closure-20261104` (`cbafa5e`), base `feat/whatsapp-module-foundation` | A estabilização WhatsApp/Inbox não está consolidada na main. |
| PR #18 | aberta, não draft; `feat/workspace-contextual-nav-20261108` (`664183e`), base PR #17 | Representa a árvore de integração mais recente inspecionada, porém depende da cadeia não integrada. |
| PR #19 | aberta, **draft**; `docs/funnels-builder-blueprint-20261108` (`1d58b09` antes desta auditoria), base `main` | Contém **somente proposta PRD/ADR**. É o lugar apropriado para este Product Gate. |
| Comparação `main...PR18` | 335 commits à frente, 0 atrás na leitura | Grande dívida de integração; CI verde não equivale a merge nem a prontidão de produção. |
| Regras da branch | API retornou lista vazia de rulesets; branch protection individual respondeu 403 para esta integração | **Não há prova de checks obrigatórios aplicados**. Confirmar na administração do GitHub antes de liberar merge/deploy. |
| CI dos commits consultados | PR #17: 16 checks em `success`; PR #18: 10; PR #19 original: 2, incluindo Governance structure | Resultados de GitHub Actions são válidos para os SHAs consultados; não equivalem a E2E real nem provam checks mandatórios. |

O código observado nesta auditoria foi lido **na branch da PR #18**. A PR #19 continua baseada na main propositalmente, para documentar a proposta sem introduzir runtime. Os textos antigos de arquitetura podem descrever estados históricos e devem ser contrastados com os arquivos efetivos.

## 2. Matriz de lacunas (status da árvore PR #18, não de produção)

| Requisito | Estado | Evidência / limite |
| --- | --- | --- |
| Kernel montável, NestJS Core Host e manifesto de módulos | **Implementado na branch** | `packages/core-kernel`; `apps/core-host/config/modules.json`; `loadInstalledPlugins`. |
| Tenant isolado por banco, membership autenticada e autorização OpenFGA | **Base implementada na branch** | `PgMembership`, `FgaPermission`, `TenantPgProvider`; testes de produção não verificados aqui. |
| CRM canônico de pessoas e funcionários | **Parcial** | `crm_people`, `crm_employees`; Employee não é usuário Keycloak. |
| Entidade canônica de equipes, membros e vínculo principal de login ↔ funcionário | **Ausente na árvore inspecionada** | Nenhuma tabela/contrato de equipe operacional identificada; não confundir `crm_employees` com equipe. |
| Inbox: conversa, mensagem, atribuição, status e histórico | **Implementado na branch; aceite incompleto** | `modules/inbox`; estado de conversa NÃO é estado de protocolo. |
| Gateway Whatsmeow | **Implementado na branch; aceite incompleto** | `modules/whatsapp`; preservar IDs, envio, recibos, deduplicação e histórico. |
| Navegação contextual e Inspector | **Implementado na branch da PR #18** | Frontend da PR #18; não implica motor de protocolos funcional. |
| Grupos/funis, drafts, etapas, transições, snapshots publicados | **Inexistente** | Nenhum `modules/service-management`. |
| Templates instaláveis e privados | **Inexistente** | Apenas PRD/ADR proposta. |
| Protocolos, resultados, eventos, transferências e filas | **Inexistente** | Não reutilizar `inbox_conversations` como protocolo. |
| Operador online/elegível, escalas e capacidade | **Inexistente** | Não simular disponibilidade. |
| Scheduling executável | **Não demonstrado / somente contrato de módulo planejado** | `modules/scheduling/AGENTS.md`; não prometer agendamento. |
| Contrato transacional de banco do tenant | **Lacuna** | `TenantDatabase.query` usa chamadas independentes a `pool.query`; não expõe transação entre múltiplas instruções. |
| Autorização granular por comando e por funil | **Lacuna** | `SyndesPlugin.permissions` e `FgaPermission` aceitam `read/write`; não há escopo específico de protocolo/funil. |
| CI do novo pacote e migration gate | **Ausente** | Workflows atuais não incluem `modules/service-management/**`. |

## 3. Revisão crítica da PRD e ADR #19

1. **Conflito com MVP congelado.** `MVP-SCOPE.md` coloca CRM pipeline e automação genérica no pós-MVP; `MODULE-ORDER.md` já fixa a sequência. Recomendação: **ciclo separado** de Gestão de Atendimentos; não alterar silenciosamente os documentos do MVP. Aprovação de produto pendente.
2. **Permissões propostas não encaixam no código atual.** `service:funnels/publish` como ação OpenFGA não funcionará sem mudar kernel/adapter/modelo. No primeiro incremento, usar recursos/capacidades distintas traduzidas explicitamente em `read/write`, ou introduzir extensão pequena e testada; jamais presumir suporte a verbos arbitrários. Publicar deve ter grant diferente de editar.
3. **Leitura pode ser ampla demais para RH.** O modelo OpenFGA de `resource.can_read` inclui `tenant#member` quando o recurso está vinculado ao tenant. Para processos restritos, **não** conceder automaticamente leitura de instâncias a todos os membros; definir autorização por grupo/funil, equipe e protocolo antes do runtime de casos sensíveis.
4. **Equipes não existem.** Criar um domínio mínimo de equipe reutilizável, vinculado por FK ao `crm_employees` do tenant, sem duplicar `Person`, `Employee` ou `UserAccount`. Definir a ligação verificada entre principal Keycloak e empregado antes de atribuição nominal; no catálogo, não inferir presença ou competência.
5. **Modelo de versão mistura lifecycle e edição.** Separar identidade do funil (`active/archived`), rascunho editável com `revision` e snapshot publicado imutável com `version` e `checksum`. `published` não é estado mutável de uma mesma definição.
6. **Validação do grafo.** Um resultado terminal não deve ser confundido com simples estado/etapa. Exigir entrada única definida ou regra explícita de entrada; chaves estáveis; todas as transições para etapas existentes; ao menos um resultado alcançável; sem estados travados sem justificativa; ciclos/retornos permitidos.
7. **Publicação é uma transação.** Não executar `BEGIN` e `COMMIT` através de `TenantDatabase.query` em chamadas separadas de pool: podem usar conexões distintas. Estender o port com transação pinada ao cliente **ou** oferecer uma operação SQL única realmente atômica; acrescentar conflitos por `expectedRevision`.
8. **Referências entre tenants.** Vincular funil/equipe/empregado sempre com FKs compostas `(tenant_id,id)`, inclusive no mesmo banco por tenant; negar enumeração antes de abrir o banco.
9. **Reabertura, transferência e casos paralelos.** Adiar runtime até contrato de protocolo aprovado; passagem por vários funis não substitui identidade do protocolo; subprotocolos ficam fora do primeiro incremento.
10. **Dependências de release.** PR #18 não está na main. Não converter CI verde em licença para aplicar migração no DevServer01; normalizar a cadeia de PRs e o controle de branch primeiro.

## 4. Recomendação de corte vertical: Incremento 1 — Catálogo versionado

**Objetivo:** administrador autorizado cria grupos, equipes mínimas, identidades de funis e um rascunho de definição; valida o grafo e publica `v1` imutável pela API. Sem editor visual, protocolo, template, IA, WhatsApp ou agendamento neste incremento.

**Pacote montável:** `modules/service-management/`, `@syndes/service-management`, dependências declaradas `platform` e `crm`; `AGENTS.md`, `package.json`, `tsconfig.json`, `src/contracts.ts`, `src/service.ts`, `src/postgres.ts`, `src/service.controller.ts`, `src/nest.module.ts`, `src/plugin.ts`, `src/validation.ts` e `test/*`. Usar port de identidade e banco do Core Host, não integrar Whatsmeow.

**Entidades/tabelas mínimas candidatas (validar namespacing antes do DDL):**

- `svc_groups`: UUID, tenant, nome, arquivamento.
- `svc_teams` e `svc_team_members`: equipe tenant-scoped e membros referenciando `crm_employees`; vínculo autenticado do operador é requisito separado de atribuição, não assumir que `employee.id = actor.id`.
- `svc_funnels`: identidade estável, grupo, owner/created_by e lifecycle.
- `svc_funnel_teams`: N:N tenant-scoped entre funis e equipes.
- `svc_funnel_drafts`: definição editável validada, `revision`, versionamento otimista.
- `svc_funnel_versions`: snapshots publicados imutáveis, `version`, `checksum`, autoria e publicação.

Evitar `ServiceSession`, `ServiceEvent`, `ServicePolicy`, `ServiceMessageLink`, `ServiceTemplate` e SLA no primeiro PR. Etapas, transições e outcomes podem residir no JSONB validado de draft/snapshot neste corte; só normalizar tabelas-filhas se consultas/constraints reais exigirem. Revisão explícita de JSON schema e tamanho máximo obrigatório.

**APIs previstas (ainda não implementadas):** rotas `/v1/tenants/:tenantId/service` para listar/criar grupos e equipes; listar/criar funis; ler/editar `draft` com `expectedRevision`; associar equipes; `validate`; `publish`; listar snapshots. Tenant derivado de membership validada, recursos/autorização resolvidos pelo servidor. A API deve retornar `401/403/404/409` de forma consistente e não vazar registros.

**Portas/Host para adaptar:** `packages/core-kernel/src/contracts.ts` e `apps/core-host/src/tenant-database.ts` para transações reais, se necessárias; `apps/core-host/config/modules.json`, `apps/core-host/package.json` + lockfile, `apps/core-host/Dockerfile`, `apps/core-host/src/module-host.ts` apenas se contrato não suportar o pacote; modelo OpenFGA/provisionamento para grants de catálogo e publish separados. Não expandir autorização global sem teste negativo.

**SQL/migração:** `modules/service-management/sql/001_service_catalog.sql`, `CREATE ... IF NOT EXISTS` apenas com verificação real de compatibilidade de schema; constraints, índices e FKs compostas; migração twice e ledger/estratégia de controle de versão revisados. Scripts de migração atuais não mantêm histórico por banco; evitar “já aplicado” inferido só de IF NOT EXISTS.

**Testes obrigatórios:** validação de grafo (caminhos, ciclos, terminais, IDs inválidos); CRUD; publicação imutável, v2 sem alteração de v1; `expectedRevision`/concorrência; associação N:N; empregado fora do tenant e IDs órfãos; não autorizado; tenant A/B; erro de OpenFGA antes de resolver DB; migração aplicada duas vezes no PostgreSQL descartável; build/pack/host/http. Testes de autorização devem exercer grants de **publicar** diferentes de **editar**.

**Critério de DONE:** PR código aprovado, checks obrigatórios efetivos, API testada com dois tenants, snapshot sem mutação, pacote host montável, migração validada e evidências de teste. Se não houver aprovação do Product Gate, manter apenas o planejamento, sem escrever runtime.

## 5. Sequência GitHub → CI → DevServer01

1. **Fase 0:** manter PR #19 como `draft`, com este parecer vinculado; obter decisão explícita sobre **ciclo separado** e sobre a política de leitura restrita.
2. **Dependências:** revisar e integrar em ordem os PRs encadeados relevantes, evitando squash/rebase arbitrário que invalide checks, ou abrir PR de código do Incremento 1 **com base na PR #18** para review isolado até a integração da cadeia. Não abrir o Incremento 1 sobre a main esquelética.
3. **Branch do Incremento 1 (após gate):** `feat/service-management-catalog-v1` a partir do SHA aprovado da árvore funcional; PR voltado à base funcional que realmente contém Kernel/Host/CRM.
4. **CI:** criar workflow `service-management.yml` com build, unit, integração PostgreSQL descartável, security cross-tenant e migrações twice. Atualizar filtro de paths e builds de `core-host-infra.yml` e Dockerfile para incluir pacote; assegurar jobs em PRs encadeados e base correta.
5. **Proteção:** configurar/confirmar required checks na branch de integração e na main; API da integração não autorizou inspecionar `branch/protection`. Ausência de rulesets retornados não comprova ausência de proteção tradicional.
6. **Release:** registrar commit, PR, tag/artefato, testes, migração, backup e rollback de aplicação; implantar apenas versão aprovada no DevServer01, sem logs verbosos persistentes nem mensagens WhatsApp de teste reais.
7. **Pós-deploy:** smoke autenticado, 401/403, tenant A/B, health e regressões Inbox/CRM/WhatsApp, com rollback preparado. O estado operacional do DevServer01 **não foi verificado nesta auditoria**.

## 6. Decisões aguardando aprovação

- **PG-01:** aceitar Gestão de Atendimentos como fase de produto **separada** do MVP original (recomendação: SIM).
- **PG-02:** equipe mínima tenant-scoped dentro do novo contexto enquanto não houver módulo comum de Teams (recomendação: SIM, contrato reutilizável e sem duplicar CRM).
- **PG-03:** restringir leitura por funil/protocolo e não herdar `tenant#member` para dados sensíveis (recomendação: OBRIGATÓRIO antes de protocolos com dados de clientes/RH).
- **PG-04:** publicar catálogo via API antes do Designer visual, priorizando um corte seguro e verificável (recomendação: SIM).
- **PG-05:** escolher baseline funcional e governar integração da cadeia de PRs antes de deploy de novo código (recomendação: SIM).

**Saída deste documento:** auditoria e plano executável. **Não é implementação do módulo, aprovação final do Product Gate, ou evidência de deploy.**
