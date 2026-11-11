# ADR — SM-03C: contrato canônico Service Management × Control × Instalador

**Data:** 2026-11-11 · **Estado:** implementado e testado com Postgres 17 descartável; sem deploy, restore real ou ativação de módulo. Complementa o diagnóstico [ADR-SERVICE-INSTALLER-COMPATIBILITY-PREFLIGHT-20261111.md](ADR-SERVICE-INSTALLER-COMPATIBILITY-PREFLIGHT-20261111.md).

## Decisão de identidade

- **ID canônico de módulo**: `service`, em Control Catalog, PgModuleInstaller, Kernel `executeModule`, descritor NestJS e manifest de release.
- **Pacote de build**: `@syndes/service`; diretório-fonte continua `modules/service-management` para evitar mudança estrutural desnecessária na árvore. `apps/core-host/package.json` e locks declaram o novo pacote, sem ativar o plugin.
- **Schema PostgreSQL reservado**: `service`, coincidindo exatamente com `TrustedModuleRelease.id` e `TrustedModuleRelease.schema`. Migrations 001–003 criam tabelas, funções, triggers e índices somente em `service`. Leituras compartilhadas, FKs e triggers fazem referência explícita aos objetos canônicos em `public`.
- **URL de produto inalterada**: `/v1/tenants/:tenantId/service-management/...`; o path é um contrato de apresentação e não identifica módulo em Control.
- **Recursos FGA canônicos**: `service:funnels`, `service:attendances`, `service:teams` e `service:team:<uuid>` (origem/destino). A permissão `inbox:conversations/read` permanece uma autorização separada para o Inspector. Tuplas com prefixo antigo `service-management:` **não** autorizam as novas ações; devem ser provisionadas explicitamente e auditadas em staging. Nenhum alias automático, claim do navegador, ou grant auto-criado por equipe Workforce.

A versão `0.3.0` permanece porque a implementação anterior nunca foi instalada operacionalmente. **Se houver algum tenant instalado fora da visibilidade do Control atual, esta premissa deixa de valer e a migração exigirá estratégia específica de dados/identidade, não execução direta.**

## Migrações e atomicidade

O `PgModuleInstaller.apply` é o único caminho autorizado futuramente: ele cria `service`, fixa `search_path=pg_catalog`, inicia sua própria transação e registra cada alteração no ledger `_syndes.module_migrations`. Arquivos 001, 002 e 003 **não contêm** `BEGIN/COMMIT` externos e não mudam `search_path`; todos os nomes necessários são qualificados. A migration Workforce `007_staff_roles_pre_release.sql` continua manual e usa `public` — ela **não é** aprovada automaticamente pelo manifest de Service.

O manifest confiável é construído somente em código de operador, `apps/core-host/src/service-release.ts`, lendo os três SQLs **do pacote instalado e revisado**, calculando SHA256, estabelecendo `expectedRelations` explícitas e fixando schema, versão e dependências `organizations/crm/inbox`. O parâmetro `imageDigest` exige formato SHA256, mas a **verificação de origem/autenticidade da imagem ainda deve ocorrer na pipeline aprovada pelo operador**; o código não assina nem autentica imagens. O construtor do instalador recusa checksums/IDs/versões/artefatos incompatíveis.

As tabelas operacionais existentes de CRM, Inbox e Workforce **não** foram movidas nem copiadas; os vínculos permanecem com `public`. Nenhum banco real recebeu SQL de Service.

## Evidências executadas

Comando principal: `bash scripts/service-management/run_disposable_pg17.sh --disposable --ack-synthetic`. Ele cria um único contêiner `postgres:17-alpine` com porta somente no loopback, label de fixture, sem mount persistente, e o remove ao finalizar.

- **19/19 testes** de domínio/Nest HTTP/SQL Service e dois tenants isolados. As migrations Service são executadas dentro de uma transação explícita com `SET LOCAL search_path=pg_catalog` para detectar referências não qualificadas; preservam isolamento tenant/org/Workspace, FGA por equipe, histórico append-only e Inbox.
- **9/9 verificações** do ciclo real `PgModuleInstaller.plan/apply/verify` e manifest operador: Control **simulado em memória**, **PG17 real** para schemas e ledger. Testam recusa de tenant B, modo read-only de `plan`, SQL 001–003 com checksum e índice físico, repetição idempotente, detecção de checksum alterado, falha na migration 003 com **rollback integral do schema e do ledger**, bloqueio da role runtime sem grants.
- **14/14 testes** do preflight e **65 aprovados/16 ignorados** na suíte completa do Core Host sem fixtures opcionais. Imagem Docker do Host construída, plugin/SQL/manifest presentes e **ausentes de `apps/core-host/config/modules.json`**; imagem de teste removida.
- O preflight `python3 scripts/service-management/readiness_preflight.py --json` agora retorna `source_compatible=true` para o novo ID/schema/SQL; mesmo assim `safe_to_install_or_enable=false` e `--strict` termina com status 2, porque não existem provas de restore/entitlement/grants.

## Gates que continuam bloqueados

1. **Control operacional:** migrations de catálogo, entitlements, installs e suas credenciais aprovadas ainda não foram implantadas no Control local; `Organizations/007`, módulo Service e ledger tenant também faltam. Read-only inventory separado não autoriza DDL.
2. **Dependências:** installer precisa de versões Catalog aprovadas e instalações verificadas em cada tenant para `organizations`, `crm` e `inbox`. O teste de SM-03C usa recibos e catálogos **sintéticos**, portanto não prova migrações reais desses módulos para schemas próprios.
3. **Segurança operacional:** role de instalador dedicada; runtime com grants mínimos aos objetos `service`; prova de ausência de DDL/truncate e de alterações de audit por runtime; Keycloak/OIDC real, OpenFGA efetiva e grants dinâmicos das equipes; testes A/B no staging.
4. **Backup/restore real:** evidência criptográfica, recuperação isolada autorizada, rollback e decisão de cutover. A fixture PG17 não substitui DR.
5. **Produto:** só após os gates anteriores habilitar plugin em `config/modules.json`, testar Inspector/Kanban com operadores reais e obter Product Gate. PR de código **não** é permissão de deploy.

**Separação:** esta frente não altera scripts de GitHub Actions (Issue #94), PR #92 WhatsApp, frontend de outro chat, Control real, mídia, ou tenant operacional.
