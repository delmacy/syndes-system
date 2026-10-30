# AGENTS.md — Core CRM

## Status

**DONE — PRD-001 Product Gate aceito em CRM-11 (2026-10-28).**

O próximo módulo funcional é Inbox (PRD-002), conforme a ordem global. Mudanças futuras no Core CRM só entram para corrigir BUG/BLOCKER ou suportar diretamente um contrato aprovado de módulo consumidor.

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

`Person != UserAccount` e `Employee != UserAccount`: um Employee pode ser vinculado a uma conta do tenant, mas perfil e identidade/login são registros distintos.

Funcionários/atendentes usam a mesma aplicação e jornada CRM. `tenant_admin` configura o escopo de atendimento do `tenant_member` com valores fixos `cpf`, `pj` ou `both`; não criar um permission engine genérico.

O backend aplica o escopo em CRUD, relações, busca, timeline e import/export. `cpf` vê Persons clientes sem vínculo PJ; `pj` vê Organizations PJ e suas Persons de contato; `both` vê ambos. `tenant_member` não arquiva nem exporta; `tenant_admin` tem acesso completo.

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

Criar e manter os testes junto com cada componente e fatia de implementação; não acumular a cobertura para uma etapa final. Cada mudança deve incluir testes no nível adequado ao comportamento alterado (unitário, integração ou UI), preservar os existentes e registrar os comandos/resultados de validação.

E2E de frontend é opt-in: sinalizar quando for necessário para aceite, mas não executá-lo durante o desenvolvimento normal. Quando sua execução for solicitada ou necessária para um gate, usar script Playwright headless que gere logs/resultados e revisar esses outputs; não dirigir manualmente o frontend para validar a jornada.

- CRUD;
- relações;
- busca;
- duplicidade;
- normalização;
- import/export;
- archive;
- permissões;
- filtro de customer scope (CPF/PJ/ambos) em todas as operações relacionadas;
- tenant isolation;
- audit;
- migrations;
- concorrência básica.

## Acceptance Journey

Login → Organization → Person → Relationship → Tags → Note → Search → Timeline → Archive → CSV export.

Tenant B não acessa dados de Tenant A.
