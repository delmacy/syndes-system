---
title: "C04 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

> L9: \| Documentação \| Modelo OpenFGA, ports e consumidores mapeados com owner e testes \| Auditoria parcial; revisão formal pendente \|

> L11: \| Integração sintética \| Testes de adapters, escopo e suíte in-memory OpenFGA versionada \| Não equivale a acesso real do tenant/operador \|

> L12: \| Operação DevServer01 \| Container `syndes-security-access-openfga-1` observado **Up** em 13/11 \| Não foi consultado model ID vigente, health autenticado ou decision log \|

> L25: 1. **P0 — estado efetivo desconhecido:** `fga-model.json` é contrato versionado; model ID/tuples/store reais do OpenFGA DevServer01 não foram consultados. Não afirmar migração de `event_delivery`.

> L41: **Próxima auditoria documental:** C05 — Secrets OpenBao. A existência de um arquivo/modelo nunca confirma permissões efetivas.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L9: \| Serviço OpenFGA v1.22.1 \| `infra/security-access/compose.yaml` \| `openfga-migrate` executa migration do serviço; `openfga` usa arquivo de configuração privada e redes internas \|

> L11: \| Segredos runtime \| `infra/security-access/openbao/render_runtime.py` e políticas \| Token/base/store não devem ser publicados \|

> L15: \| Governança \| `docs/engineering/ADR-EVENTS-OPENFGA-SERVICE-GRANTS-20261111.md`, `WBS-EVENTS-OPENFGA-SERVICE-20261111.md` \| Contratos de implantação/gates, não operação homologada \|

> L17: `infra/security-access/fga-model.json` não contém classes TypeScript, `package.json` ou endpoints de negócio próprios. O provedor possui endpoint externo OpenFGA, mas as chamadas listadas abaixo são **implementadas em outros owners**.

> L62: - O armazenamento técnico do OpenFGA utiliza PostgreSQL conforme Compose (service `openfga-migrate` e `openfga`). **Não** atribuir suas tabelas às migrations de tenant ou à outbox Control.

> L64: - O OpenFGA check **não emite evento de negócio por si**. O objeto `event_delivery` autoriza entregas de C06; envelopes/outbox pertencem ao Event Platform.

> L67: **Sem prova operacional nesta auditoria:** `fga-model.json` ativo no store, tuples de usuários/serviços, Store ID efetivo, cobertura das rotas, replay, integração com contas ou tenants reais.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

> L3: > **NÃO É RUNBOOK HOMOLOGADO.** O container OpenFGA foi observado Up no DevServer01 (13/11/2026); o modelo, stores, tuples, versões e resultados reais **não foram consultados**. Sem operação de escrita, autenticação administrativa ou deploy.

> L7: 1. Verificar versão/digest OpenFGA, health e config ativa com operador autorizado; registrar metadados seguros, sem divulgar endpoint privado, tokens, IDs de recursos ou tuples.

> L11: 5. Exigir sign-off de C01/C03/C04/A04/A06/C06, testes CI e testes HTTP/PG17/OpenFGA no ambiente-alvo por SHA antes de registrar Product Gate.

> L15: - Não executar `openfga-migrate`, DDL, comandos de tuple write, mudanças de modelo, policy, OpenBao ou grants reais.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/04-contratos-e-dependencias-publicas.md)

> L3: Contrato externo OpenFGA: `POST /stores/{store}/check` com `tuple_key`, retornando `allowed` booleano. **Store/model ID e grants efetivos não verificados.**

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L17: **Persistência:** OpenFGA usa PostgreSQL próprio de serviço conforme Compose; `fga-model.json` não é migration SQL Tenant nem Control. `openfga-migrate` pertence à inicialização operacional do provedor.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
