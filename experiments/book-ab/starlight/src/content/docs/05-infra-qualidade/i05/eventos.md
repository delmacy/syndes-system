---
title: "I05 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/REFERENCIA-TECNICA.md)

> L9: \| `infra/postgres/compose.yaml` \| `postgres:17-bookworm` \| `postgres_data`, `syndes-data` e `syndes-master-data` externas; secrets montados de runtime, sem porta de banco publicada no manifesto \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/OPERACAO.md)

> L9: 3. Com autorização operacional, coletar **somente campos sanitizados** de rede, `internal`, portas publicadas, privilégios, health e labels; nunca registrar env, tokens, mounts privados, IPs privados ou caminhos sensíveis.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/04-contratos-e-dependencias-publicas.md)

> L3: O contrato do I05 é **declarativo**, não export TypeScript: Compose services, nomes de redes externas, volumes, mounts, `depends_on`, secrets e restrições de execução. Consumidores são workloads de I04, C03, C04, C05 e Manager. `openfga-migrate` é job de migração declarado; não executar como teste de documentação. Não há endpoint HTTP, evento de negócio, contrato de frontend ou migration SQL atribuível ao I05. Evidên

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
