# CRM-01 — Revisar registry/migration e prova CI

- **Módulo/gate:** Platform Core mínimo para Core CRM / Sprint 0.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / pronta para despacho; sem endpoints.
- **Responsável recomendado:** OpenCode Free, uma dispatch mutável; Codex revisa.
- **Issue/branch/commit/PR:** não existentes; sem operações externas nesta ordem.

## Objetivo e contexto

Revisar o slice de registry Control Plane já presente e fechar sua evidência PostgreSQL descartável. O schema e a migration foram criados, mas migration local não foi aplicada e o workflow ainda não foi executado em GitHub.

## Incluído

- Conferir schema Drizzle, SQL, journal, migrator e package scripts para alinhamento, idempotência de execução do migrator e ausência de segredos.
- Adicionar testes unitários/integration necessários para schema/migration runner e migration de zero em PostgreSQL descartável.
- Ajustar workflow API para rodar a migration e checar contrato sem executar endpoints ou E2E frontend.
- Documentar resultado real dos comandos e limitações do ambiente.

## Excluído

- Implementar endpoint, autenticação, tenant provisioning, tenant DB runtime, UI ou alterar o escopo do registry.
- Reintroduzir `drizzle-kit` sem decisão/revisão explícita.
- Alterar dependências compartilhadas sem justificar risco/necessidade.

## Dependências e ownership

- Pode correr sem CRM-00 desde que não publique endpoint nem amplie schema além do handoff aprovado.
- Permitidos: `apps/api/src/modules/platform-core/control-plane/**`, `apps/api/drizzle/control-plane/**`, `apps/api/scripts/**`, `apps/api/package*.json`, `.github/workflows/api.yml`, testes diretamente necessários e README API.
- Proibidos: `apps/api/src/modules/core-crm/**`, `apps/web/**`, contratos de auth/context ainda abertos e docs de módulos posteriores.
- Contrato consumido: registro Control Plane descrito no handoff; não alterá-lo sem registrar breaking implications.

## Critérios de aceite e testes

- Migration parte de banco PostgreSQL 16 vazio e cria enum/tabela/constraints esperadas.
- Reaplicar migrator não duplica objetos nem corrompe estado.
- `npm ci`, lint, typecheck, unit, build e audit continuam verdes; teste de migration usa serviço descartável.
- Nunca persistir/emitir connection credentials; `database_name` permanece referência não secreta.
- E2E frontend: não aplicável e não deve ser executado.

## Evidência, risco e encerramento

- Reportar comandos, logs resumidos do migration CI, arquivos e limitações; não incluir URL/credential real.
- Risco conhecido: CI hosted não prova isolamento completo de runtime tenant; não alegar esse gate.
- Próximo owner: Codex revisão/aceite; depois CRM-02/03.
