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


## Gate ENABLED por módulo (FC-02.02, candidato)

O Core Host é o único dono da configuração SYNDES_CRM_MODULE_GATE=legacy|enforce; legacy é default compatível enquanto Control DB real não foi migrado. Nunca aceitar modo vindo de cliente, header, feature flag React ou parâmetro de URL. Quando enforce, toda API CRM passa por CrmDefaultContextGuard → CoreKernel.executeModule com módulo confiável crm antes do lease do banco tenant. Manter FGA por recurso e operação, SQL 002 e as relações Organization/Workspace mesmo se ModuleAccessPort responder true. Não ativar em DevServer01 sem restore/backfill e controle de todos os tenants. Ver docs/engineering/FC-02-02-CRM-MODULE-GATE-CANDIDATE-20261110.md; continuidade de Inbox/WhatsApp/Support segue FC-02.01/02.

## Reconciliação WhatsApp (CRM-WA-01)

CRM Person é canônica e Organization de plataforma determina ownership; ChannelIdentity WhatsApp nunca se equivale a um UserAccount. Só vínculos inequívocos por identidade externa ou telefone E.164 comprovadamente associado podem ser propostos. Não sobrescrever nomes confirmados com pushname de WhatsApp. O reconciliador atual é READ-ONLY; criação provisória, links transacionais, auditoria e revisão de ambiguidades permanecem pendentes. Não fazer DML no tenant real sem aprovação do dry-run.
