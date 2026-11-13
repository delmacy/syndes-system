# A04 Core Host — auditoria inicial de código (13/11/2026, 09h)

> **EVIDÊNCIA PARCIAL, NÃO HOMOLOGAÇÃO.** Fonte Git `f4fbfe5`; auditoria estática sem deploy, conexão a banco, consulta de segredo, chamadas OpenFGA/Keycloak ou ativação de workers. STATUS de A04 permanece baseline até reconciliação documental independente.

## Continuidade de repositório

- `origin/main` consultado: `75d99e087896531013241b4e45c3318bab2e71b1`; branch local de integração documental `docs/publication-gate-20261113` em `f4fbfe5`, **ainda não publicada**.
- `docs/a06-audit-checkpoint-20261113` em `de7b065` e `docs/a06-documentation-20261113` em `3c1db91`; A06 já consta parcial no plano da integração.
- Worktree principal `feat/workspace-contextual-nav-20261108` tem arquivos modificados e novos testes locais; **não tocados**.

## Contratos e ownership observados

| Fonte | Símbolos e contratos | Limite da evidência |
|---|---|---|
| `apps/core-host/src/main.ts` | NestJS `CoreService`, `CoreController`, composição `createHostModule`, `bootstrap`; `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config`, `POST /v1/tenants/:tenantId/authorize` | Controller Core Host; não significa que cada plugin/rota esteja operacional |
| `apps/core-host/src/module-host.ts` | `loadInstalledPlugins`, `installModuleAssets`: lista explícita, import trusted, verificação de ID/dependências, assets por rota exata GET/HEAD | Não é marketplace dinâmico nem sandbox de plugin não confiável |
| `apps/core-host/config/modules.json` | Cinco plugins listados: CRM, Inbox, WhatsApp, Organizations, Support | Lista declarativa não comprova instalação/ativação por tenant |
| `apps/core-host/src/adapters.ts` | `ActorVerifier`, `PgMembership`, `FgaPermission`, `fgaResourceObject` | Gates de identidade, membership e FGA; decisões reais não testadas |
| `apps/core-host/src/secrets.ts` | `loadCoreSecrets`, `openBaoSourceFromEnv` | Contrato de bootstrap OpenBao, não leitura de segredo real |
| `apps/core-host/src/tenant-database.ts` | `resolveRegistry`, `TenantCredentialSource`, `TenantPgProvider` | Provedor de transação tenant; banco runtime não verificado |
| `apps/core-host/src/module-{catalog,lifecycle,effective-access,installer}.ts` | Catálogo, lifecycle, access efetivo, installer/attestor/activator | Contratos com Control, gates e migrações a validar por SHA |
| `apps/core-host/src/platform-event-*.ts` | Publisher, dispatcher, worker admission, batch, composition e grants de service OpenFGA | Worker não deve ser ativado por auditoria; provas de eventos descartáveis/PG17 pendentes |

## Gate e execução de testes

- `python3 scripts/docs/audit_consistency.py --check`: **17 parcial / 57 unidades, 40 baseline, 0 discrepâncias de catálogo**.
- `python3 scripts/docs/source_evidence.py --json`: **nenhuma divergência lexical nos witnesses existentes**. Isso não mede a cobertura total dos símbolos do A04.
- **Não executado** `npm test` do A04 nesta worktree: `node_modules` e `dist` ausentes. O comando inclui `link-peers` e `build`, portanto deve rodar em cópia descartável com dependências isoladas, nunca na worktree de terceiros.
- Testes PG17 e OpenFGA em `apps/core-host/test/*-pg17*.mjs` e `*fga*.mjs` não foram executados; exigem infraestrutura de teste segregada.

## Próximo incremento de auditoria

1. Preparar cópia descartável com dependências Node pinadas e executar `npm run check` e testes unitários sem PG17; registrar quantidade, falhas e hash do lockfile.
2. Inventariar controllers dos plugins NestJS, endpoints HTTP, dependências e owners sem confundir A04 com funcionalidades CRM/Inbox/WhatsApp/Organizations/Support.
3. Inspecionar migrations Control/Tenant, grants, idempotência, outbox e políticas de gate; mapear cada classe pública a witness e testes negativos.
4. Reconciliar A04 STATUS, REFERENCIA-TECNICA, OPERACAO, oito capítulos e plano em worktree **documental separada**, sem marcar homologado.
5. Publicação `https://delmacy.github.io/syndes-system/` depende de push/CI e verificação do SHA no site; HTTP 200 não prova atualização.

**Risco:** zero divergências no registry atual não implica zero omissões de código. É necessário ampliar cobertura por owner antes de declarar documentação fiel.
