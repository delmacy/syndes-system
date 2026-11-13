---
title: "I05 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)

> L9: \| PostgreSQL \| `infra/postgres/compose.yaml`: imagem `postgres:17-bookworm`, volume `postgres_data`, redes externas `syndes-data`/`syndes-master-data`, healthcheck \| Não há prova de backup, restore, grants ou firewall \|

> L17: **Limites de ownership:** I05 trata Docker/redes/volumes; I06 Traefik, I07 Tailnet, I08 Komodo, I12 hardening, I04 PostgreSQL e C03/C04/C05 conservam seus contratos. Nenhum container, secret, volume, porta, migration ou configuração foi alterado.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/REFERENCIA-TECNICA.md)

> L9: \| `infra/postgres/compose.yaml` \| `postgres:17-bookworm` \| `postgres_data`, `syndes-data` e `syndes-master-data` externas; secrets montados de runtime, sem porta de banco publicada no manifesto \|

> L13: **Interfaces/contratos:** não há API HTTP, classe TypeScript ou frontend próprio do I05. Interfaces são manifests Compose, nomes de rede, mounts, configuração runtime e restrições de conectividade. APIs de identidade, segredo, autorização, tenant e Manager pertencem aos módulos respectivos. Não atribuir schemas/migrations SQL a I05; o volume PostgreSQL pertence ao serviço de I04 e `openbao_raft` ao serviço C05.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L16: Topologia **declarada** e parcial, sem representar IPs, portas efetivas ou tráfego. `postgres_data` pertence à persistência PostgreSQL; `openbao_raft` ao cofre. Não há Tenant DB, Control DB, classes ou frontend próprio do I05. Configurações secretas e env_file não foram lidas.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
