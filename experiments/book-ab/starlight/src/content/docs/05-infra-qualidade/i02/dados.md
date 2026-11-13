---
title: "I02 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L9: \| **Documentação I02** \| **AUDITORIA PARCIAL:** 8 capítulos, ambiente/serviço/owner, topologia, dependências, inventário live sanitizado e WBS reconciliados \| Que os donos de host, segurança, dados e release tenham aprovado \|

> L11: \| **Saúde de containers** \| PostgreSQL 17 principal e Manager visual relatavam **healthy**; **14 containers sem healthcheck Docker** \| Que os 14 estejam unhealthy ou que os 2 tenham Product Gate \|

> L12: \| **Persistência/segredos** \| PostgreSQL, Keycloak, OpenFGA e OpenBao observados; scripts e volumes versionados/localizados \| Bancos migrados, grants corretos, OpenBao unseal seguro, backup e restore \|

> L16: \| **Container de ensaio** \| PostgreSQL 17-alpine `Up` há ~43h, sem label de descartável ou projeto Compose \| Que pode ser eliminado sem impacto; requer identificar owner \|

> L17: \| **Staging/produção** \| **NÃO VERIFICADOS**: conectores de `server02` e `win1-server` offline \| Que os hosts estejam inativos, sem software ou sem dados \|

> L24: 3. **P1 — container PostgreSQL de teste sem lifecycle claro.** PG17-alpine avulso, `Up` há ~43h, sem label de descarte. Investigar owner e dados antes de limpeza; **não apagar nem migrar automaticamente**.

> L45: - **Não foi executado:** deploy, migração, dump/restore, restart, cleanup, leitura de dados/segredos, alteração de firewall, Komodo, Traefik, serviço ou branch alheia.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 12/11/2026 (America/Sao_Paulo); coleta live 13/11/2026 02:27 UTC.** Baseline Git `9ac228e8cb21cb37f5c6892063dfdbc3d0238f20`, DevServer01. Foram examinados manifests e metadados do Docker **somente em leitura**. **Não foi realizada inspeção de server02, win1-server, staging nem produção.** Nenhuma senha, IP/hostname privado, URL administrativa, mapeamento de portas nem dados de `docker

> L11: \| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) \| 1 serviço PostgreSQL 17-bookworm, volume de dados, secrets por arquivo, redes de dados e Manager \| I04/C01/C02: databases/roles, migrations/tenants separados \|

> L15: \| [`modules/whatsapp/deploy/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/deploy/compose.yaml) \| Gateway Go/Whatsmeow, dados + rede egress \| P03/I09; autorização de canal e sessão precisam de prova própria \|

> L26: \| **Desenvolvimento** \| DevServer01 — conector remoto online e Docker consultado \| 16 containers em execução; Docker, PostgreSQL, IAM, secretos, Komodo/Traefik, Host, Workspace, WhatsApp, previews \| **OBSERVADO em 12/11/2026**, health funcional e Product Gate não homologados \|

> L38: \| Healthchecks \| **2 healthy**, sendo PostgreSQL principal e Manager visual; **14 sem indicador Docker health** — *não significa 14 unhealthy* \|

> L39: \| Redes \| **13** ao todo (3 Docker padrão); redes de dados/Manager com `internal=true` \|

> L42: \| PostgreSQL de teste \| PG17-alpine com nomenclatura de ensaio, em execução há ~43h, sem label de descarte nem owner de projeto; loopback; **não limpar automaticamente** \|

> L49: \| Persistência de aplicação \| PostgreSQL 17-bookworm \| Um servidor DB principal observado; databases/roles/restore ainda não validados \|

> L55: \| Testes ad hoc \| PostgreSQL 17-alpine sem label/projeto \| Necessidade/owner desconhecidos; risco de resíduo de ensaio e uso de recursos \|

> L63: - **Control/Manager x Tenant:** múltiplos databases no PostgreSQL principal conforme `infra/README.md`; papéis de menor privilégio e banco individual por tenant, sujeitos a ensaio real pela I04/C01.

> L75: - [I01 — DevServer01](../I01-devserver01/OPERACAO.md), [I03 — host auxiliar](../I03-win1-server/OPERACAO.md), [I04 — PostgreSQL](../I04-postgresql/REFERENCIA-TECNICA.md), [I05 — Docker](../I05-docker-e-redes/REFERENCIA-TECNICA.md), [I06 — Traefik](../I06-traefik-https/REFERENCIA-TECNICA.md), [I07 — Tailnet](../I07-tailnet/OPERACAO.md), [I08 — Komodo](../I08-komodo/REFERENCIA-TECNICA.md), [I12 — Segurança do host](../

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

> L3: > **RUNBOOK DE CONSULTA SOMENTE LEITURA — NÃO HOMOLOGAÇÃO OPERACIONAL.** A inspeção do DevServer01 em 12/11/2026 não autoriza mudanças em containers, dados, rede ou produção.

> L42: - **Dados e resiliência:** [PostgreSQL](../I04-postgresql/REFERENCIA-TECNICA.md), [Backup/Restore](../I10-backup-e-restore/OPERACAO.md), [Release/Rollback](../I11-release-e-rollback/OPERACAO.md).

> L60: 5. Não parar, remover, reiniciar ou coletar dados de containers avulsos (incluindo o PostgreSQL PG17 de teste) sem confirmação do owner e plano próprio.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **I02 não implementa API HTTP do produto, pacote Node, classes NestJS ou Event Bus.** O contrato de I02 é a **composição versionada de infraestrutura**, seu procedimento aprovado e a rastreabilidade com os owners de dados, identidade, aplicação e segurança.

> L7: \| Docker Compose de PostgreSQL \| `infra/postgres/compose.yaml` — I04/I02 \| 1 serviço PostgreSQL 17 com volume nomeado, redes de dados e secrets montados por arquivo; não habilita tenant automaticamente \|

> L8: \| Bootstrap de Control/Tenant \| `infra/postgres/bootstrap/*` — C01/C02/I04 \| SQL e shell de provisionamento autorizados; init só em volume novo, migrations requerem gate próprio \|

> L20: 1. Redes Docker aprovadas (dados, identidade e secretos) e TLS/secret store provisionados por operador.

> L22: 3. PostgreSQL e databases técnicos preparados; migrations e roles executados com ownership e backup.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L33: \| `infra/postgres/compose.yaml` \| PostgreSQL 17, 2 redes dados/Manager, volume e Docker Secrets \| PostgreSQL principal `healthy`, redes observadas \| DB, papéis, backup, grants e restore \|

> L35: \| `apps/core-host/compose.yaml` \| Host A04 na rede de dados/IAM/secrets \| Core Host base e outra composição de cutover `Up` \| Paridade de imagens/config e roteamento efetivo \|

> L59: - PostgreSQL é **servidor compartilhado**, mas os bancos `Control`, `Keycloak`, `OpenFGA` e tenants são logicamente distintos; `bootstrap` define criação e papéis, não garante aplicação real em volume já existente.

> L60: - OpenBao usa **volume Raft próprio**, fora do PostgreSQL. Komodo usa **MongoDB** como armazenamento da administração de containers, sem se tornar banco do produto.

> L61: - Foram vistos **19 volumes Docker**, sem inspeção dos dados. Contagem não indica backup válido ou consistência de snapshots.

> L62: - O PG17 de ensaio (container avulso sem label de descartável) permanece em execução; não deve ser classificado como persistência de produção ou apagado sem identificar owner.

> L66: - **13 redes** Docker observadas (inclui 3 padrão); as redes de dados e as dedicadas ao Manager têm flag `internal=true`. Isso restringe encaminhamento externo em Docker, mas **não** substitui roles, firewall nem teste de ACL.

> L70: - A versão do Docker Engine observada é **29.9.2**; tags principais: PostgreSQL 17, Keycloak 26, OpenFGA 1, OpenBao 2, Traefik 3 e Komodo 2. Versão de imagem não comprova digest imutável nem política de atualização.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
