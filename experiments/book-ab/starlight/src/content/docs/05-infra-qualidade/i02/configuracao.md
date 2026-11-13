---
title: "I02 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L10: \| **DevServer01** \| **OBSERVADO:** Docker Engine 29.9.2, **16 containers Up**, **8 projetos Compose**, **2 avulsos**, **13 redes** (3 padrão), **19 volumes** \| Que esteja homologado, com serviços/segurança/backup funcionando \|

> L15: \| **Platform Manager** \| Frontend visual avulso `healthy`; Compose de API/Web encontrado no Git \| Manager completo (API+OIDC+grants) em operação \|

> L16: \| **Container de ensaio** \| PostgreSQL 17-alpine `Up` há ~43h, sem label de descartável ou projeto Compose \| Que pode ser eliminado sem impacto; requer identificar owner \|

> L49: \| 2026-11-12 23:27 America/Sao_Paulo (13/11 02:27 UTC) \| DevServer01, metadados Docker e manifest Git `9ac228e` \| 16 Up, 8 Compose, 2 avulsos, 13 redes, 19 volumes \| Evidência de desenvolvimento, não homologação \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L11: \| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) \| 1 serviço PostgreSQL 17-bookworm, volume de dados, secrets por arquivo, redes de dados e Manager \| I04/C01/C02: databases/roles, migrations/tenants separados \|

> L12: \| [`infra/security-access/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/security-access/compose.yaml) \| Keycloak 26, OpenFGA 1 com migrate one-shot, OpenBao 2 com Raft \| C03/C04/C05: identidade, autorização e segredos \|

> L13: \| [`infra/master-admin/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/master-admin/compose.yaml) \| Manager API + web em redes segregadas \| A05/A02; configuração declarada **não é Manager implantado** \|

> L14: \| [`apps/core-host/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/compose.yaml) \| Core Host NestJS, 3 redes de serviço, 4 secrets por arquivo e imagem aprovada \| A04; versão/runtime dependem do deploy e do manifest usado \|

> L15: \| [`modules/whatsapp/deploy/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/deploy/compose.yaml) \| Gateway Go/Whatsmeow, dados + rede egress \| P03/I09; autorização de canal e sessão precisam de prova própria \|

> L17: \| [Runbook do DevServer01](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) \| Workspace/Keycloak/Host em desenvolvimento e Compose locais do host \| Snapshot 01/11/2026; pode estar desatualizado \|

> L27: \| **Homologação/staging** \| Não foi possível associar host a um release homologado \| Existem scripts/Compose/planos de homologação, não prova de instância aprovada \| **NÃO VERIFICADO** \|

> L32: Comandos de coleta executados **somente leitura**: `docker version --format`, `docker ps --format`, `docker inspect` **filtrado em memória para não expor Env/secretos**, `docker network ls/inspect` e `docker volume ls -q`. **Snapshot temporal: não representa estado atual em datas futuras.**

> L37: \| Containers \| **16 em estado Up**, distribuídos em **8 projetos Compose** identificáveis e **2 avulsos sem label Compose** \|

> L41: \| Bindings \| Traefik publica portas wildcard; Komodo tem bind em endereço específico; apps observados com loopback ou nenhuma porta publicada; **ACL/firewall não verificados** \|

> L64: - **OpenBao:** volume Raft próprio e arquivos de segredo entregues ao runtime segundo política; **não** mapear credenciais para env/Pages.

> L65: - **Docker/Compose:** redes nomeadas e overlays locais; nomes e tags de imagem não garantem digest reprodutível, ausência de drift ou rollback.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

> L49: 2. Consultar **apenas metadados** da execução, sem `docker inspect` integral nem valores de `Env`, secrets, mounts de origem, routes ou domínio:

> L58: 3. Para publicar, **redigir um resumo por função**, removendo nomes de host, portas, IPs, logs privados, values de env e caminhos físicos de mounts. Conferir Compose declarado versus services observados e ownership de cada overlay/preview.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L33: \| `infra/postgres/compose.yaml` \| PostgreSQL 17, 2 redes dados/Manager, volume e Docker Secrets \| PostgreSQL principal `healthy`, redes observadas \| DB, papéis, backup, grants e restore \|

> L34: \| `infra/security-access/compose.yaml` \| Keycloak, FGA migration/API, OpenBao/Raft \| Keycloak, OpenFGA e OpenBao `Up` \| TLS interno, health funcional, realm/store, rotação \|

> L35: \| `apps/core-host/compose.yaml` \| Host A04 na rede de dados/IAM/secrets \| Core Host base e outra composição de cutover `Up` \| Paridade de imagens/config e roteamento efetivo \|

> L36: \| `infra/master-admin/compose.yaml` \| API e web em redes segregadas \| Apenas frontend visual avulso `healthy`, não o stack completo \| Identidade Manager, API real, release, isolamento \|

> L37: \| `modules/whatsapp/deploy/compose.yaml` \| Gateway com rede de egress \| Gateway observado `Up` \| Sessão, callbacks, ownership do canal, idempotência \|

> L68: - Containers de aplicação e identidade publicam portas em loopback ou nenhuma, conforme a coleta. Nenhum IP, hostname interno, URL administrativa, porta ou secret foi transcrito.

> L69: - `infra/.env.example` e `infra/.env.ci` são contratos de configuração/fixação para desenvolvimento e fixtures; **não** são prova de ambiente produtivo provisionado. Não copiar valores.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
