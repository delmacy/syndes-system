## 3. Capabilities arquiteturais

**G01 não expõe capabilities de negócio nem declara API de runtime.** Suas capacidades são decisões, documentação e critérios de revisão.

| Capability documental | Evidência localizada | Estado desta auditoria |
|---|---|---|
| Mapa de ownership por unidade | `catalog/work-units.json`; `docs/subprojects/index.json` | Registro presente; governança de alterações requer revisão |
| Composição modular de Kernel, Host e plugins | `packages/core-kernel/src/module-registry.ts`, `apps/core-host/src/module-host.ts`, `apps/core-host/config/modules.json` | Código e config examinados; implantação não verificada |
| Contratos públicos explícitos | `packages/core-kernel/src/index.ts`, `package.json#exports` de CRM/Inbox/WhatsApp | Superfícies declaradas; compatibilidade de consumidores a auditar |
| Fronteira Control/Tenant | [ADR de composição](../../../engineering/ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md) | Decisão documentada; ACL e grants reais pendentes de teste |
| Isolamento de frontends por contexto | [ADR frontend/backend](../../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md), `apps/master-admin-web`, `apps/workspace-web`, `packages/front-shared` | Estruturas de projeto presentes; sessão real não verificada |
| Integração por eventos versionados e outbox | `packages/core-kernel/src/platform-events.ts` e `control-plane-events.ts`; ADRs de eventos | Contratos/código encontrados; workers e schemas operacionais não auditados |
| Consulta de WBS e histórico | [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md), [plano documental](../../../blueprint/PLANO-ATUALIZACAO-MODULOS.md) | Fontes presentes; associação não comprova execução |

### O que não é uma capability disponível

- Configuração futura de perfis de deploy por instância (CMP-01–10), importação remota entre Hosts e marketplace de plugins — **não** considerar implementados.
- Schemas `crm`, `inbox`, `whatsapp` por módulo em todos os tenants — desenho-alvo, **não** comprovação de migração aplicada.
- API de módulos ENABLED/entitlements end-to-end e worker de eventos ativo — exigir gate Control/tenant, autorização e evidências.
- G01 como owner de regras de CRM, WhatsApp, Inbox, Billing, Identity ou SQL — proibido substituir os respectivos owners.

Para cada capacidade operacional, consultar o [módulo proprietário](../../../blueprint/CATALOGO-MODULOS.md) e sua aba correspondente; **não duplicar uma segunda implementação normativa nesta G01**.
