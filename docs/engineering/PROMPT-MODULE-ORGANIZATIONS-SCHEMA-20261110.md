# Prompt de execução — primeiro módulo: Organizations

Você está trabalhando no repositório canônico `delmacy/syndes-system`. Atue como arquiteto e tech lead implementador do **módulo Organizations (organizações, workspaces, unidades, memberships e Workforce)**, **um módulo por vez**, com testes obrigatórios antes de qualquer merge. Use a WBS mestre `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`, a WBS/ADR de schemas da PR #65 e a fundação Billing/Metering `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md`. Leia `AGENTS.md` da raiz e `modules/organizations/AGENTS.md` e suas instruções complementares. Não extrapole features nem frontend.

## Contexto aprovado

- Cada **tenant tem database PostgreSQL próprio**. Cada módulo deve ter **schema próprio** dentro desse database; o módulo desta frente será `organizations`. O Control Plane permanece em `syndes_control` separado; não copiar `tenant_registry`, `tenant_memberships`, conta global, grants de account, contas Keycloak ou owner do Platform Manager para schema de tenant.
- `packages/core-kernel` e `apps/core-host` são a base de integração. O contrato inicial de `ModuleAccessPort` / `executeModule` e metadados `schema` está na PR #66; a WBS arquitetural está na PR #65. Pode haver PRs abertas: **verifique o SHA real da main e resolva pré-requisitos por integração explícita, nunca por suposição ou duplicação de código**.
- Keycloak autentica; OpenFGA autoriza; OpenBao gerencia segredos técnicos; Core Host valida tenant/org/workspace, entitlement e contexto antes de acessar o database. Owner de account e proprietário global **não** ganham autorização automática nos dados operacionais.
- `organizations` é domínio estrutural e **não deve conter lógica comercial de cobrança**. A futura unidade faturável é contratual e ainda não definida; `employee != login != membership != operador faturável`. Preparar origens de eventos quando justificadas, sem inventar preço ou cobrar usuários.

## Objetivo exclusivo desta frente

Migrar o domínio Organizations para um schema PostgreSQL `organizations` **sem alterar funcionalmente as permissões, o modelo de account nem a política de multi-organização**. Adaptar o SQL de criação, views/funções, triggers, guards, índices, clients e testes, preservando os contratos públicos e as dependências dos consumidores CRM/Inbox/WhatsApp. Não construir Billing, Marketplace, app visual ou modificar módulos de domínio de terceiros sem prova de necessidade e delimitação explícita.

## Ordem obrigatória

1. Inspecionar `modules/organizations/sql/001..007` e demais migrations: tabelas `platform_*`, FKs, índices, backfill, funções `SECURITY DEFINER`, `search_path`, consultas do Core Host, CRM, Inbox, WhatsApp TS/Go e testes. Mapear impacto antes do primeiro DDL. Encontrar qualquer objeto criado dinamicamente; não depender apenas de buscas por `CREATE TABLE`.
2. Confirmar que o catálogo de módulos/instalações, a verificação per-tenant e o instalador versionado estão disponíveis e testados (WBS AK-10, AK-30). Se **não** estiverem, implementar apenas componentes locais compatíveis e abrir dependência objetiva; não aplicar schema em banco operacional nem afirmar instalabilidade concluída.
3. Definir DDL qualificado para `organizations` e migrar referências, queries e gatilhos sem permitir controle de `search_path` por dados HTTP. Garantir rollback testado em banco descartável. Control Plane **não** é migrado.
4. Preservar a trava SQL 002 `platform_legacy_single_organization` / `platform_legacy_single_workspace` e checagens de `pg_indexes`, ajustando `schemaname` conforme necessário. **Não habilitar multi-org nem remover restrições** sem Product Gate #31.
5. Manter idempotência de bootstrap, segregação do owner e ACL mínima. Um módulo desabilitado deve ser negado, sem DROP/DELETE dos dados; respeitar dependências de CRM/Inbox/WhatsApp e Support.
6. Testar PG17 descartável com dois tenants, rollback, isolamento, revogação de membership, Keycloak/OpenFGA reais quando viável, grants SQL, tentativa cross-tenant/org/workspace e reexecução de migrations. Executar testes de Core Kernel, Organizations, CRM/Inbox/WhatsApp impactados (Go se houver SQL de gateway envolvido). Não remover testes existentes para passar CI.
7. Documentar provas, diffs, commits, PR e estado Product Gate. Reportar o que foi modificado, o que continua bloqueado e quais testes não foram executados.

## Não executar

- Não executar `DROP SCHEMA ... CASCADE`, não limpar DevServer01, não alterar bancos ou grants de ambientes operacionais sem inventário/backup/controle explícito.
- Não modificar GitHub Actions (outra frente), proteção de main ou deploy por conta própria.
- Não criar menus/telas fictícios ou APIs fora do planejado; não duplicar `front-shared`.
- Não mover o Control DB para o tenant DB; não usar login de Platform Manager como supertenant.
- Não criar Billing/Payments nem registrar custos monetários no Kernel.

## Entregáveis esperados

- Inventário/ADR de impacto do domínio Organizations e plano claro de migração.
- Código + migrations isoladas ao módulo, com compatibilidade verificada; schema exclusivo `organizations`.
- Suites completas com evidência PG17, Keycloak/OpenFGA e regressões impactadas; CI integrada após PR.
- Checklist WBS AK-40.01 atualizado com itens efetivamente verificados e bloqueios honestos.
- Não iniciar CRM automaticamente: **terminar e relatar Organizations**, depois o usuário decide a próxima frente.
