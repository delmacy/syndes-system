---
title: "Q10 · Missão e fronteiras"
description: "Volume Infraestrutura e qualidade · capítulo Q10 · matéria 01"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/01-missao-objetivos-e-fronteiras.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 1. Missão, objetivos e fronteiras

### Missão da Q10

Definir a **disciplina de evidências para impedir regressões e promover qualidade**, preservando a separação de responsabilidades: o código da Q10 verifica **integridade estrutural e contratos mínimos de agente**; a política transversal referencia as demais suites e os gates de produto/operação executados por seus owners.

| Q10 deve fazer | Q10 não deve fazer |
|---|---|
| Verificar arquivos obrigatórios e AGENTS dos módulos com owner `tests/integrity` | Substituir testes unitários, contratos, integração, segurança, E2E ou performance |
| Estabelecer critérios mínimos e evidências de transição | Declarar `DONE` porque um arquivo/script/commit existe |
| Exigir resultados do CI e das suites exigidas, sem apagar falhas e skips | Alterar o workflow da Q07 ou a suíte de outro owner sem autorização |
| Relacionar requisitos, testes, ambiente, SHA/digest e responsável de aceite | Declarar deploy real após ensaio descartável de PG/Keycloak/OpenFGA |
| Exigir isolamento de tenants e autorização *fail-closed* em gates apropriados | Liberar multi-org, migrações, dados de cliente ou grants por decisão documental |
| Tornar bloqueios e plano de recuperação transparentes | Fazer `main` parecer verde removendo teste obrigatório ou branch protection |

### Política de aceite existente

- [AGENTS global](https://github.com/delmacy/syndes-system/blob/main/AGENTS.md) exige regras aceitas, persistência, autorização, isolamento, testes, observabilidade, erros tratados, segurança e jornada demonstrável antes de `DONE`.
- [TEST-STRATEGY](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/TEST-STRATEGY.md) separa **commit/branch** (integridade, dependências, lint, typecheck, unit, build), **PR** (integração, migrations, tenant isolation, autorização, contratos, segurança, build) e **Release Candidate** (stress, spike, soak e recovery em ambiente apropriado).
- A [mainline](https://github.com/delmacy/syndes-system/blob/main/.github/workflows/syndes-ci.yml) possui `foundation`, `impact`, `regression`, paridades de identidade e `gate`; um job requerido falho, cancelado ou indevidamente ignorado deve bloquear o gate.
- **Go-live** exige além do CI: identidade, tenant, grants, backups/restores reais, rollback, smoke com perfis reais, observabilidade e autorização expressa do responsável.

**Status desta revisão:** Q10 possui teste estrutural identificável, mas a **mainline auditada está vermelha** e nenhum Product Gate/Go-live foi homologado nesta atividade.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/01-missao-objetivos-e-fronteiras.md).
