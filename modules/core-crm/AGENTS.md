# AGENTS.md — Core CRM

## Status

**CURRENT MODULE — PRD-001**

Nenhum outro módulo funcional deve avançar para implementação antes do Product Gate do Core CRM.

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
