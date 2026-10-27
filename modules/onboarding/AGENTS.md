# AGENTS.md — Onboarding

## Missão

Transformar contratação aprovada em tenant operacional de modo repetível e idempotente.

## Fluxo

cliente → tenant → database → storage → admin → plano → módulos → configuração → tenant ativo.

## Regras

- UI não executa operações privilegiadas diretamente.
- Provisioning executa operações e registra estado.
- Cada step deve poder ser retomado.
- Retry não pode criar recurso duplicado.
- Secrets são referenciados, não expostos.
- Falha parcial deve ser observável e recuperável.

## Não fazer

- instalador universal de módulos futuros;
- dezenas de cenários pós-MVP;
- provisionamento hyperscale.

## Testes

- happy path;
- retry/idempotency;
- partial failure;
- resume;
- duplicate request;
- permissions;
- database/storage mapping;
- audit.
