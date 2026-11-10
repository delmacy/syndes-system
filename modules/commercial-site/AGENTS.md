# AGENTS.md — Commercial Website

## Missão

Explicar o problema, apresentar o produto, preço e conduzir prospect para demonstração/contratação.

## Posicionamento

Não vender “CRM sofisticado”. Comunicar organização de clientes, conversas, agenda e assistente digital.

## Escopo

- proposta de valor;
- funcionalidades Basic;
- preço;
- condições de promoção;
- demonstração/CTA;
- contato/contratação;
- transparência sobre preço do terceiro mês;
- termos relevantes de pagamento/inadimplência.

## Não fazer

- portal de marketing gigante;
- CMS complexo;
- afiliados;
- marketplace;
- conteúdo internacional/multilíngue no MVP.

## Segurança

- forms validados;
- proteção anti-abuso;
- nenhum dado sensível desnecessário;
- fluxo de pagamento conduzido ao PSP conforme arquitetura aprovada.

## Testes

- responsive;
- accessibility baseline;
- form validation;
- pricing consistency;
- CTA flow;
- security headers/config quando implementado.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.