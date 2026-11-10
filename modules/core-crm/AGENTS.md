# AGENTS.md — Core CRM

## Status

**MÓDULO COM PENDÊNCIAS DE PRODUTO — PRD-001**

O backend CRM possui aceite de desenvolvimento, mas **o módulo não está concluído**, especialmente o frontend e as jornadas de utilização. Em 2026-11-01, o responsável pelo produto autorizou priorizar a **Inbox** antes do fechamento de todas as pendências do CRM. Nenhuma pendência deve ser transformada em DONE automaticamente; retomar os critérios abertos antes do lançamento.

## Missão

Ser a fonte canônica de cadastro e relacionamento básico de pessoas e organizações.

## Entidades aprovadas

- Person
- Organization
- Relationship
- Employee
- Tag
- Note
- Timeline
- ChannelIdentity

`Person != UserAccount` e `Employee != Login`.

## Escopo MVP

- CRUD seguro;
- busca por nome, empresa, telefone, email, CNPJ e tags;
- normalização de contatos;
- relações pessoa ↔ organização;
- tags;
- notas;
- timeline;
- archive/soft delete;
- CSV import/export;
- alerta simples de possível duplicidade;
- identidades externas de canal vinculadas à Person.

## Não fazer

- pipeline;
- deals;
- lead scoring;
- forecasting;
- propostas/orçamentos;
- marketing automation;
- custom fields avançados;
- IA dentro do domínio CRM.

## Regras de canal

CRM é source of truth.

Nomes externos podem preencher cadastro novo, mas não sobrescrevem silenciosamente nome confirmado no CRM.

Manter separação entre nome CRM, push name, business name e demais metadados externos.

## Segurança

- Toda operação resolve tenant antes do acesso.
- IDs de outro tenant devem resultar em denied/not found.
- Archive é fluxo normal; destruição definitiva exige operação controlada.
- Audit para mudanças relevantes.
- Export respeita permissões.
- CSV precisa de validação, limites e tratamento seguro.

## Testes obrigatórios

- CRUD;
- relações;
- busca;
- duplicidade;
- normalização;
- import/export;
- archive;
- permissões;
- tenant isolation;
- audit;
- migrations;
- concorrência básica.

## Acceptance Journey

Login → Organization → Person → Relationship → Tags → Note → Search → Timeline → Archive → CSV export.

Tenant B não acessa dados de Tenant A.


## Autorização recente de finalização (2026-11-01)

O responsável pelo produto autorizou concluir as tarefas pendentes de frontend Core CRM nesta iteração, mesmo após priorização anterior da Inbox. A implementação do Workspace permanece modular e exige capacidades por ação, formulários, registros relacionados e testes. A branch `feat/crm-workspace-completion` documenta o progresso em `docs/product/CORE-CRM-FRONTEND-COMPLETION.md`. **Não declarar Product Gate fechado apenas com CI ou mocks**.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.