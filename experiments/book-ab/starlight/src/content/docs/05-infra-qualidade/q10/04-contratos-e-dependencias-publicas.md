---
title: "Q10 · Contratos e dependências"
description: "Volume Infraestrutura e qualidade · capítulo Q10 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos públicos, dependências e responsabilidade

### Contrato da Q10

**Entrada:** checkout com SHA/branch, catálogo, `AGENTS.md` e arquivos mínimos; **saída:** teste de integridade com exit code e logs, consumido pelo job `foundation`. Q10 **não** publica API HTTP, evento, contrato TypeScript, migration ou serviço de banco de dados. O teste retorna falha se faltarem arquivos ou contratos locais de agente.

| Fonte/owner | Contrato de verificação | Risco de extrapolação |
|---|---|---|
| Q10 — `tests/integrity/repository-structure.sh` | Lista obrigatória de arquivos, AGENTS por módulo e `scripts/architecture/check-work-units.mjs` | Arquivos presentes ≠ feature implementada ou segura |
| Q07 — `syndes-ci.yml` e planner | Job `foundation`, seleção impact/full e `gate` | Configuração YAML não garante execução bem-sucedida |
| Q02/Q03 — testes por módulo e integração | Unidades, contratos, integridade de estado e migrations | Mock/PG descartável ≠ sistema operacional |
| Q04/Q05 — browser, identidade e segurança | E2E com perfis, autorização, isolamento e falha segura | Token fictício não comprova Keycloak/OpenFGA real |
| Q06/Q08/Q09 — performance, release e infraestrutura | Stress, spike, soak, smoke, backup/restore e rollback | Execução sintética ≠ homologação da operação |
| Produto, owners e operação | Product Gate e aceite explícito | Contagem de testes ou cobertura não substitui decisão do responsável |

### Contrato mínimo de evidência por gate

| Campo | Preenchimento verificável |
|---|---|
| ID do requisito e owner | Identificador do PRD/ADR/WBS, sem inventar ID normativo |
| Revisão | SHA integral, árvore/artefato e dependências relevantes |
| Camada | Unit, contrato, integração, segurança, E2E, infra, RC, operação |
| Ambiente | Runner, banco descartável ou ambiente-alvo, identidade e configuração aprovada |
| Execução | Comando/run/job, data, duração, exit code, falhas e skips |
| Resultado | PASS, FAIL, BLOCKED, NOT_RUN ou NOT_APPLICABLE com justificativa |
| Risco | Escopo não coberto, mock/fixture, migração, concorrência, tenant A/B |
| Aceite | Responsável, decisão, critério e evidência de aprovação **se existir** |

**Falha fechada:** se um job requerido falhar, for cancelado ou ficar `skipped` sem razão permitida, o gate reprova. Um resultado `NOT_RUN` não pode virar `PASS` com checklist manual. Não copiar dados pessoais/segredos de execução em logs públicos.

### Mudança de contrato ou suite

Se uma API, evento, port, migration ou política mudar, o owner identifica os consumers e pede suites de regressão pertinentes; novos módulos também precisam ser considerados pelo planner. Alterações em `scripts/ci`, `.github/workflows`, infraestrutura e API pertencem a Q07/owners, **não** à presente revisão da Q10.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/04-contratos-e-dependencias-publicas.md).
