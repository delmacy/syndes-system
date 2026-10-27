# CRM-02 — Provisionamento idempotente de tenant

- **Módulo/gate:** Platform Core mínimo / Sprint 1.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / bloqueada por CRM-00 e CRM-01.
- **Responsável recomendado:** OpenCode Free, uma dispatch mutável; Codex revisa.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e contexto

Criar database PostgreSQL exclusivo do tenant, aplicar baseline tenant migration fora do API startup e atualizar estado Control Plane de forma idempotente, diagnosável e segura para retry.

## Incluído

- Serviço de provisioning com transições permitidas, idempotency/concurrency control e erros recuperáveis.
- State machine CRM-00: `pending → in_progress → ready|failed`; retry `failed → in_progress`; repeated ready request is an idempotent no-op.
- Generate database name from permanent tenant UUID; create a separate least-privilege database role and store credentials only in the approved deployment secret store.
- Use a per-tenant concurrency lock; run migrations sequentially outside API startup and resume idempotently from durable step state.
- Failed attempts keep sanitized stage/result and partial state safe for retry; never log credentials or connection strings.
- Testes unitários de estados/retries e integration com PostgreSQL descartável (múltiplos retries e falha intermediária).

## Excluído

- API pública/admin, UI, billing/entitlements, suspensão/remoção de tenant, acesso a conteúdo CRM por Platform Admin.
- Pool de conexões ilimitado ou limite numérico sem medição.

## Dependências, áreas e contratos

- Depende de CRM-00 (transições, secret/config e migration contract) e CRM-01 (registry migration provada).
- Permitidos: providers/services de provisioning Control Plane, scripts de migrations tenant, testes e config de integração estritamente necessária.
- Proibidos: CRM domain/API, Next.js, schema de CRM antes de CRM-05, endpoints e arquivos de auth owned por CRM-03.
- Consumir tenant ID estável, database reference não secreta, provisioning state e configuração aprovada; não aceitar database/tenant do request.

## Critérios de aceite e validação

- Mesmo tenant e mesmo estado inicial em retries não criam database/tenant duplicado nem corrompem a migration.
- Falha parcial fica observável e retry seguro; credenciais nunca aparecem em log/output.
- Apenas serviço autorizado consegue criar database; input externo não compõe SQL de identificador sem validação/quoting seguro.
- Testar banco descartável com sucesso, duplicação concorrente e falha/recovery.
- Unit/integration/lint/typecheck/build verdes conforme package; não executar frontend E2E.

## Evidência e próximo responsável

- Listar estado antes/depois e logs sanitizados; informar limitações de privilégios do ambiente.
- Próximo owner: Codex revisão; depois CRM-03 integra resolução/auth sem sobrepor ownership.
