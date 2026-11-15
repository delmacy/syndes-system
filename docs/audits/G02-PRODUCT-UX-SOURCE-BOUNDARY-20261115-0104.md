# G02 — Produto e UX: auditoria de fronteiras (2026-11-15 01:04 BRT)

## Base e método
- Repositório: `delmacy/syndes-system`; main observada: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (commit 2026-11-14 11:43:37 UTC).
- Branch exclusiva: `audit/g02-product-ux-boundaries-20261115-0104`, criada a partir do SHA exato acima.
- Fonte: GitHub MCP; leitura de `catalog/work-units.json`, `catalog/README.md`, `modules/README.md`, `README.md`, `modules/core-crm/AGENTS.md`, `modules/service-management/AGENTS.md`, `apps/workspace-web/AGENTS.md`, `apps/workspace-web/src/App.tsx`, `src/app/feature-registry.ts`, `src/app/workspace-feature-outlet.tsx`, `docs/engineering/MAINLINE-CI-POLICY.md` e `docs/engineering/TEST-STRATEGY.md`.
- Este documento é uma amostra de fronteiras G02, **não** revisão exaustiva das 57 unidades, dos fluxos de UX, nem evidência de teste/deploy.

## Contratos públicos e privados
- `G02` é owner transversal em `docs/product` com maturity `distributed`, não um serviço executável próprio. O catálogo separa ownership de implantação/aceite.
- `workspaceFeatures` enumera `overview`, `inbox`, `crm` e `settings`; a navegação primária só inclui as três primeiras. `requiresApi` é requisito de renderização, **não** concessão de permissão. `resolveWorkspaceView` restringe hash a views registradas e usa overview como fallback.
- `WorkspaceFeatureOutlet` monta componentes CRM, Inbox, Overview, SecurityInfo e WhatsAppAccountsFeature sob Settings. Renderers são fixos, não extensões dinâmicas; API ausente mostra barreira de login para CRM/Inbox.
- `App.tsx` inicia autenticação Keycloak, instancia `TenantApi` por token/config e descarta cliente no ciclo de sessão. Esses controles de UI não substituem guard, FGA ou isolamento SQL.
- CRM: `Person` difere de `UserAccount`; `Organization` de CRM difere da Platform Organization; WhatsApp pushname não deve sobrescrever nome confirmado. Jornada completa de aceite, permissões, CSV, concorrência e multi-tenant ainda exigem comprovação por testes e produto.
- Service Management: plugin NestJS e SQL 001–003 são descritos no contrato, mas **não montados no Host**; não inferir rota operacional, menu ou migrations aplicadas. Dependências declaradas: Control ENABLED, FGA, Workforce 007, restore/grants e Product Gate.

## Classes, APIs, eventos e schemas
- Classes/componentes examinados: `App`, `WorkspaceFeatureOutlet`, `workspaceFeatures`, `resolveWorkspaceView`, `viewRequiresApi`; `TenantApi` apenas como consumidor/importação, implementação não inspecionada nesta rodada.
- API pública própria G02: nenhuma demonstrada; chamadas de CRM/Inbox/WhatsApp pertencem aos módulos correspondentes. Não foram auditados handlers HTTP, DTOs ou políticas de autorização nesta rodada.
- Eventos de CRM citados em contrato: `inbox.participant.observed.v1`, `crm.person.resolved.v1`, `crm.person.review_required.v1`. Publicação/consumo real no Host e schema de payload **não verificados**; contrato declara consumidor operacional de revisão ainda pendente.
- Migrations G02 próprias: nenhuma demonstrada. Service SQL 001–003 e Workforce 007 são dependências do owner P05/P04; conteúdo SQL, checksums e estado aplicado não inspecionados.

## Divergências e riscos
- G02-01 — Lacuna de prova: presença de views e de barreira visual não constitui autorização backend nem jornada E2E autenticada aceita. Não elevar maturidade.
- G02-02 — Contrato P05 explicita backend instalável sem rota/menu ativo; qualquer documentação que declare Service operacional conflita com a fonte inspecionada e deve ser reconciliada no owner apropriado.
- G02-03 — A revisão de identidade WhatsApp CRM tem evento de `review_required` sem consumidor/tela operacional comprovados; não declarar fluxo UX concluído.
- Não foi feita busca exaustiva de divergências entre todas as páginas temáticas, e não se afirma que as três lacunas sejam novas.

## Testes, evidências e limites
- Testes executados: **nenhum**. Assertions de frontend, CI no SHA, integração HTTP/FGA/PostgreSQL, migrações, Playwright, homologação e deploy: **não verificados**.
- Nenhum acesso ao DevServer01; nenhum runtime, SQL, secrets, workflows, deploy, branch de terceiros ou código alterado.
- Próxima investigação: localizar PRDs e critérios de aceite reais sob `docs/product`, rastrear fluxos CRM/Inbox/Settings até controllers e guards, revisar assertions Playwright e comparar com evidências CI no SHA exato.
- Gates globais das 57 unidades, divergências zero e SHA de GitHub Pages público: **não confirmados**. Não integrar este checkpoint sem revisão e coordenação com os demais writers.
