---
title: "I05 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)

> L11: \| Manager \| `infra/master-admin/compose.yaml`: `master-api`, `master-web`, `master-private` interna, `read_only`, `cap_drop: ALL` declarados \| Não foi feita inspeção runtime nem ingress \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/REFERENCIA-TECNICA.md)

> L11: \| `infra/master-admin/compose.yaml` \| `master-api`, `master-web` \| `master-private` interna, `syndes-master-data`/`syndes-master-identity` externas; web bind em loopback; `read_only`, `no-new-privileges`, `cap_drop: ALL` declarados \|

> L13: **Interfaces/contratos:** não há API HTTP, classe TypeScript ou frontend próprio do I05. Interfaces são manifests Compose, nomes de rede, mounts, configuração runtime e restrições de conectividade. APIs de identidade, segredo, autorização, tenant e Manager pertencem aos módulos respectivos. Não atribuir schemas/migrations SQL a I05; o volume PostgreSQL pertence ao serviço de I04 e `openbao_raft` ao serviço C05.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/04-contratos-e-dependencias-publicas.md)

> L3: O contrato do I05 é **declarativo**, não export TypeScript: Compose services, nomes de redes externas, volumes, mounts, `depends_on`, secrets e restrições de execução. Consumidores são workloads de I04, C03, C04, C05 e Manager. `openfga-migrate` é job de migração declarado; não executar como teste de documentação. Não há endpoint HTTP, evento de negócio, contrato de frontend ou migration SQL atribuível ao I05. Evidên

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
