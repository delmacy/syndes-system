## 0. Endereços exatos de leitura

- Catálogo: `catalog/work-units.json`; Host: `apps/core-host/package.json`, `src/main.ts`, `config/modules.json`.
- Plugins e assets: `src/module-host.ts`; auth: `src/adapters.ts`; secrets: `src/secrets.ts`.
- Tenant: `src/tenant-database.ts`; lifecycle: `src/module-{catalog,lifecycle,effective-access,installer}.ts`.
- Eventos: `src/platform-event-*.ts`; testes: `apps/core-host/test/*.mjs`.
- Referência e gates: `docs/subprojects/A04-core-host/{STATUS,REFERENCIA-TECNICA,OPERACAO}.md`.
- Checkpoint externo: `docs/evidence/checkpoints/A04-core-host-initial-20261113-0900.md` no branch `docs/a04-code-audit-20261113`.
