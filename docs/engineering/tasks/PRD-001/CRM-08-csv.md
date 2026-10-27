# CRM-08 — CSV import/export

- **Módulo/gate:** Core CRM API / Sprint 2.
- **Classificação:** MVP.
- **Prioridade/estado:** P1 / depende de CRM-05 e CRM-03; contrato e limites vêm de CRM-00.
- **Responsável recomendado:** OpenCode Free; Codex revisa segurança.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Importar/exportar pessoas e organizações segundo contrato aprovado, com limites, feedback de erro e autorização por tenant/ação.

## Incluído

- UTF-8 with optional BOM, required header, comma delimiter; maximum 10 MiB, 10,000 rows, and 30 columns.
- Validate the whole file before write; import is atomic/all-or-nothing. If any row is invalid, write none and return up to 100 row errors plus total invalid count.
- Apply `customer_scope` to validation, import, and returned row counts/errors; only `tenant_admin` may export, and export remains tenant-scoped.
- CSV injection defense na exportação, validação sem logs de PII desnecessária e audit event.
- Tests de unit parser/edge cases e integration para auth, limits, injection, row errors, rollback/partial semantics e tenant isolation.

## Excluído

- Sincronização recorrente, formatos além do aprovado, importação de dados de outros módulos, E2E frontend.

## Dependências/ownership

- Depende de CRM-00, CRM-03 e CRM-05; pode consumir search/normalization se aprovado no mapping, mas não alterar essas APIs sem coordenação.
- Permitidos: `apps/api/src/modules/core-crm/csv/**`, seus testes e docs de contrato.
- Proibidos: Platform Core, frontend, redefinir limites/erros unilateralmente, persistência de arquivos externos permanente.

## Aceite/evidência

- Input malicioso/oversized rejeitado; nenhuma exportação cruza tenant ou bypassa permissão.
- Sem perda silenciosa: resultado informa rows aceitas/rejeitadas de modo seguro.
- Próximo owner: Codex revisão; depois UI CRM-10.
