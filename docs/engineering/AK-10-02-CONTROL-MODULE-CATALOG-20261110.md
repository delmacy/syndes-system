# AK-10.02 — Catálogo de módulos e versões no Control Plane

**Estado:** candidato implementado e testado em banco descartável; **não integrado à main nem instalado no Control DB operacional**. **Base:** PR #66 (39b2654) e WBS/ADR da PR #65. Escopo: somente a fundação do catálogo.

## Modelo e autoridade

- **public.module_catalog**: module_id e schema_name exclusivo; catálogo canônico no Control DB, separado dos dados de tenant.
- **public.module_catalog_versions**: por module_id/versão, approved, approved_at, approved_by; aprovação por operador, nunca automática. Default é false.
- **public.module_catalog_dependencies**: dependências da release via FKs. O Host confronta o grafo com manifests compilados. Platform é o substrato fixo do Kernel, não uma instalação opcional.
- **available = release aprovada + versão/schema/dependências presentes no build + tenant ativo**. Disponível não é sinônimo de entitled, installed, enabled, acesso FGA ou direito de API/job.
- **syndes_core** recebe apenas SELECT; nenhum endpoint de aprovação ou DML do Host. O Port e o adapter usam SQL com parâmetro de UUID, tabelas qualificadas, tenant_registry ativo, manifest confiável e fail-closed.
- Um release listado no Control DB mas não compilado é ignorado. Divergência de schema/deps de release compilada é erro, não fallback. Dependência indisponível impede disponibilidade.

## Ativação explicitamente bloqueada

O SQL em infra/postgres/bootstrap/control-module-catalog.schema NÃO é invocado pelo bootstrap, Host nem pipeline. Aplicá-lo em banco persistente requer inventário, snapshot, rollback, revisão de privileges e ledger versionado (AK-30). CREATE TABLE IF NOT EXISTS é reaplicável em uma estrutura intacta, mas não comprova ausência de drift.

O adapter é construído no Core Host sem rota HTTP de administração ou conexão ao executeModule legado. Os manifests dos módulos montados ainda têm metadados schema incompletos. Portanto nenhum módulo atual é habilitado por esta alteração. Não há interface visual, grants FGA nem alterações de billing.

## Evidências e limitações

- Kernel: testes de versões, schemas, dependências, build trusted, legados e respostas negativas.
- Core Host: tests de UUID, consulta parametrizada, falha de DB e mismatch.
- PG17 descartável (tmpfs): aplicar DDL duas vezes; catálogo vazio por padrão; aprovação com identificador e timestamp (sem ledger imutável nesta etapa), restrição DML da role syndes_core, invalid IDs, FKs, dependencia ausente, tenant suspenso, A/B ativos e reexecução sem perda.
- A/B ativos veem o MESMO catálogo aprovado nesta fase. Isso NÃO representa entitlements isolados; o gate A com CRM+Inbox+WhatsApp versus B somente CRM pertence à AK-10.03 e AK-10.04.

## Sequência de conclusão

1. Integrar o contrato da PR #66; trazer esta alteração ao main reconciliado.
2. AK-10.03: entitlements e transições auditadas de instalação/ativação/suspensão por tenant.
3. AK-10.04 e AK-30: adaptar ModuleAccessPort ao Host após verificar entitled+installed+enabled, schema/ledger, FGA e dependências; testes negativos A/B.
4. Apenas com autorização e backup aprovados, aplicar versões ao Control DB operacional.

**Fora do escopo:** UX, alterações de GitHub Actions, billing, migrations de Organizations da PR #68, SQL 002, multi-org ou deploy.
