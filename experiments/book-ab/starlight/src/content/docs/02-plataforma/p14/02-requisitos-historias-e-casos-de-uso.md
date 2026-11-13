---
title: "P14 · Requisitos e casos de uso"
description: "Volume Plataforma e core · capítulo P14 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos, histórias e casos de uso

Os identificadores `P14-R*` e `US-P14-*` servem somente para **referenciar decisões existentes** (`AGENTS.md`, ADR de composição e ADRs de eventos). Não constituem novos requisitos aprovados, tickets criados ou incrementos de software.

| Critério documental | Origem | Prova exigida |
|---|---|---|
| P14-R01 — Portabilidade do Kernel | `CORE-FRAMEWORK-ARCHITECTURE.md` e `ADR-COMPOSICAO-MODULAR-CORE-20261111.md` | `package.json#exports` e `CoreKernel` sem SDKs externos de infraestrutura |
| P14-R02 — Registro determinístico | `module-registry.ts` e Host loader | Rejeição de IDs/versões inválidos, duplicação, ciclos e dependências ausentes |
| P14-R03 — Membership e FGA fail closed | `contracts.ts`, `kernel.ts`, `adapters.ts` | Negativas com atores/tenants/recursos errados, erro de policy/backend |
| P14-R04 — Plugins trusted | `module-host.ts`, `plugin.ts` | Descritores instalados, IDs canônicos, rotas/migrations/permissions validados |
| P14-R05 — Gating por tenant e módulo | `module-access.ts`, `module-effective-access.ts`, `AGENTS.md` | `ENABLED` e identidade/grants confirmados no **entrypoint real** |
| P14-R06 — Proteção de transações/eventos | `platform-events.ts`, `tenant-database.ts`, `platform-event-*.ts` | Outbox/consumer inbox em transação e idempotência em DB descartável, depois staging |
| P14-R07 — Fonte de composição versionada | ADR de composição CMP-01–03 | Manifesto validado offline e startup fail-closed para perfil inválido (**planejado**) |
| P14-R08 — Release por instância | CMP-04–09 | SBOM/digest, segredo, ingress, ownership de workers e dois perfis reais (**não comprovados**) |
| P14-R09 — Boundaries de frontend | ADR-FRONTEND-BACKEND-COMPOSITION | Workspace/Manager separados; `front-shared` só visuais |
| P14-R10 — Operação e aceite | WBS/Quality Gates | SHA CI, restore real, rollback, segurança e Product Gate independentes |

### Histórias documentais

**US-P14-01:** como autor de módulo, quero consumir somente os exports públicos do Kernel e de outros módulos para manter a compatibilidade e evitar acoplamentos internos.

**US-P14-02:** como integrador do Host, quero falhar na inicialização quando houver módulo não confiável, dependência circular/ausente ou conflito de rota.

**US-P14-03:** como responsável por tenant, quero negar operação sem membership, autorização de recurso ou módulo habilitado, inclusive quando o provedor está indisponível.

**US-P14-04:** como operador, quero saber quais são os gates para executar o Event Worker em staging, sem confundir código opt-in com um processo de produção ativo.

**US-P14-05 (futuro):** como responsável por implantação, quero usar perfis imutáveis por instância **após CMP-01/02/03**, com testes de dependências, isolamento e rollback.

### Casos de uso de arquitetura

**UC-P14-A — Inicialização de plugin:** carregar `config/modules.json` confiável → validar `@syndes/.../plugin` → validar `definition.id` e descriptors → `ModuleRegistry(...).ordered()` recusa ciclos/ausência → compor NestJS → verificar secrets/Control → iniciar.

**UC-P14-B — Acesso a tenant:** Host valida JWT e cria `Actor` → Kernel valida request → `TenancyPort.canAccessTenant` → `AuthorizationPort.canAccess` → módulo (e seu gate efetivo, quando utilizado). **`executeModule` é opt-in**, não afirmar que todos os endpoints o usam.

**UC-P14-C — Emissão de evento:** efeito de negócio + outbox dentro da transação → dispatcher e consumer com idempotência e admission → gates de serviço/ENABLED/FGA. Worker manual/opt-in não implica scheduler ou deploy.

**UC-P14-D — Perfil de instância (planejado):** inventário CMP-01 → manifesto CMP-02 → dois perfis locais CMP-03 → imagem/rollout/gates posteriores. Não usar a configuração atual de plugins fixos como prova de CMP-03.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/02-requisitos-historias-e-casos-de-uso.md).
