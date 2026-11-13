---
title: "C04 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

> L10: \| Código \| Modelo JSON `schema_version=1.1`, adapters FGA de usuário e serviço, verificações fail-closed \| Não implica tuples, stores ou permissões implantadas \|

> L12: \| Operação DevServer01 \| Container `syndes-security-access-openfga-1` observado **Up** em 13/11 \| Não foi consultado model ID vigente, health autenticado ou decision log \|

> L29: 5. **P1 — disponibilidade e recuperação:** registrar health, métricas, versionamento do modelo, rollback, backup, rotação do token e tratamento de indisponibilidade.

> L38: \| C04.OPS.01 \| PENDENTE \| Health, modelo versionado, autorização de migrations/tuples, backup/restore e rollback \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L15: \| Governança \| `docs/engineering/ADR-EVENTS-OPENFGA-SERVICE-GRANTS-20261111.md`, `WBS-EVENTS-OPENFGA-SERVICE-20261111.md` \| Contratos de implantação/gates, não operação homologada \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

> L3: > **NÃO É RUNBOOK HOMOLOGADO.** O container OpenFGA foi observado Up no DevServer01 (13/11/2026); o modelo, stores, tuples, versões e resultados reais **não foram consultados**. Sem operação de escrita, autenticação administrativa ou deploy.

> L10: 4. Validar fail-closed e suspensão recuperável de workers, métricas higienizadas, rollback de versão/tuples, backup/restore e processo de recuperação.

> L17: - Não concluir implantação/segurança pela imagem Docker em execução ou pelos testes sintéticos.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/06-wbs-marcos-e-aceite.md)

> L8: \| C04.OPS.01 \| Health, observabilidade sem PII, backup/restore e rollback \| Pendente \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
