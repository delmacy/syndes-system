# AGENTS.md — Documents

## Missão

Anexar e recuperar documentos com segurança dentro do contexto dos registros do tenant.

## Escopo

- upload;
- download;
- metadata;
- relationship to entities;
- tenant storage;
- authorization;
- archive.

## Não fazer

- Google Drive clone;
- editor colaborativo;
- versionamento complexo;
- compartilhamento público avançado.

## Segurança

- validar tipo/tamanho/nome;
- storage isolado por tenant;
- URLs temporárias/autorizadas quando aplicável;
- nunca confiar em path fornecido pelo cliente;
- audit para operações críticas;
- nenhum secret em metadata.

## Testes

- upload/download;
- permissions;
- cross-tenant storage denial;
- malformed files/metadata;
- archive;
- missing object;
- limits.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.