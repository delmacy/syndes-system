---
title: "C04 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

> L25: 1. **P0 — estado efetivo desconhecido:** `fga-model.json` é contrato versionado; model ID/tuples/store reais do OpenFGA DevServer01 não foram consultados. Não afirmar migração de `event_delivery`.

> L35: \| C04.DOC.01 \| **AUDITORIA PARCIAL** \| Contratos e fontes reconciliados, evidências source-linked \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L9: \| Serviço OpenFGA v1.22.1 \| `infra/security-access/compose.yaml` \| `openfga-migrate` executa migration do serviço; `openfga` usa arquivo de configuração privada e redes internas \|

> L15: \| Governança \| `docs/engineering/ADR-EVENTS-OPENFGA-SERVICE-GRANTS-20261111.md`, `WBS-EVENTS-OPENFGA-SERVICE-20261111.md` \| Contratos de implantação/gates, não operação homologada \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

> L7: 1. Verificar versão/digest OpenFGA, health e config ativa com operador autorizado; registrar metadados seguros, sem divulgar endpoint privado, tokens, IDs de recursos ou tuples.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/04-contratos-e-dependencias-publicas.md)

> L3: Contrato externo OpenFGA: `POST /stores/{store}/check` com `tuple_key`, retornando `allowed` booleano. **Store/model ID e grants efetivos não verificados.**

> L11: Esses símbolos pertencem aos packages citados, **não** constituem classes/API pública de `infra/security-access/fga-model.json`.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
