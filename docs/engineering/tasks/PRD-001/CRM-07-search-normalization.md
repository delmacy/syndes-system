# CRM-07 — Busca, normalização e possível duplicidade

- **Módulo/gate:** Core CRM API / Sprint 2.
- **Classificação:** MVP.
- **Prioridade/estado:** P1 / depende de CRM-05 e CRM-06.
- **Responsável recomendado:** OpenCode Free; Codex revisa.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Adicionar busca pelos campos aprovados, normalização determinística e alerta simples de possível duplicidade sem merge automático.

## Incluído

- Busca por nome, empresa, telefone, email, CNPJ e tags; authorization, tenant boundary and `customer_scope` filtering apply before returning counts, facets, duplicate warnings, or results.
- Normalização de contatos/CNPJ com regra documentada, preservando valor de exibição quando necessário.
- Critério explicável de possível duplicata sem criar bloqueios falsos ou mutações automáticas.
- Unit tests para normalização/matching e integration tests para filtros, paginação/limites, permissions e tenant isolation.

## Excluído

- Busca full-text distribuída/serviço externo, scoring avançado, merge, deduplicação automática, custom fields.

## Dependências/ownership

- Depende de CRM-05/06 e API contract congelado em CRM-00.
- Permitidos: `apps/api/src/modules/core-crm/search/**`, `normalization/**`, `duplicates/**`, tests e índices migrations específicos após revisão.
- Proibidos: platform-core, CSV files CRM-08, UI, novos mecanismos de busca externos.

## Aceite/evidência

- Testes provam cada campo permitido, input limites, normalização estável e impossibilidade de inferir registros de outro tenant.
- Sugestão não mescla/edita registro; nenhum teste existente enfraquecido.
- Próximo owner: Codex revisão; depois CRM-08.
