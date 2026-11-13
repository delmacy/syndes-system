---
title: "I05 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)

> L9: \| PostgreSQL \| `infra/postgres/compose.yaml`: imagem `postgres:17-bookworm`, volume `postgres_data`, redes externas `syndes-data`/`syndes-master-data`, healthcheck \| Não há prova de backup, restore, grants ou firewall \|

> L10: \| Identidade e segredos \| `infra/security-access/compose.yaml`: Keycloak 26.8.1, OpenFGA 1.22.1, OpenBao 2.7.0; rede `syndes-secrets` com `internal: true` \| `internal` declarativo não demonstra conectividade ou seal/ACL reais \|

> L11: \| Manager \| `infra/master-admin/compose.yaml`: `master-api`, `master-web`, `master-private` interna, `read_only`, `cap_drop: ALL` declarados \| Não foi feita inspeção runtime nem ingress \|

> L13: \| Cobertura \| Três Compose principais inventariados \| Core Host, Workspace, WhatsApp, Komodo e demais stacks ainda precisam de mapeamento integral \|

> L15: **WBS:** I05.DOC.01 — **AUDITORIA PARCIAL** (fontes e ownership); I05.NET.01 — **PENDENTE** (topologia e portas efetivas sanitizadas); I05.SEC.01 — **PENDENTE** (negações/ingress/egress); I05.OPS.01 — **PENDENTE** (compose config, recovery e inventário completo); I05.GATE — **BLOQUEADO** (aceite e prova de ambiente-alvo).

> L17: **Limites de ownership:** I05 trata Docker/redes/volumes; I06 Traefik, I07 Tailnet, I08 Komodo, I12 hardening, I04 PostgreSQL e C03/C04/C05 conservam seus contratos. Nenhum container, secret, volume, porta, migration ou configuração foi alterado.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA PARCIAL DE CONFIGURAÇÃO, NÃO HOMOLOGAÇÃO OPERACIONAL.** Base `ec037df`; checkpoint `ff37302`. A configuração Compose é fonte declarativa, não prova de que containers ativos usam a mesma revisão.

> L9: \| `infra/postgres/compose.yaml` \| `postgres:17-bookworm` \| `postgres_data`, `syndes-data` e `syndes-master-data` externas; secrets montados de runtime, sem porta de banco publicada no manifesto \|

> L10: \| `infra/security-access/compose.yaml` \| `keycloak:26.8.1`, `openfga:v1.22.1`, `openbao:2.7.0`, `openfga-migrate` \| `syndes-secrets` bridge interna, `syndes-security-access`, `syndes-data`, `syndes-master-identity`; Raft `openbao_raft` \|

> L11: \| `infra/master-admin/compose.yaml` \| `master-api`, `master-web` \| `master-private` interna, `syndes-master-data`/`syndes-master-identity` externas; web bind em loopback; `read_only`, `no-new-privileges`, `cap_drop: ALL` declarados \|

> L13: **Interfaces/contratos:** não há API HTTP, classe TypeScript ou frontend próprio do I05. Interfaces são manifests Compose, nomes de rede, mounts, configuração runtime e restrições de conectividade. APIs de identidade, segredo, autorização, tenant e Manager pertencem aos módulos respectivos. Não atribuir schemas/migrations SQL a I05; o volume PostgreSQL pertence ao serviço de I04 e `openbao_raft` ao serviço C05.

> L15: **Atenção:** `openfga-migrate` é job mutável declarado, não executado na auditoria. `env_file`, secrets e caminhos de runtime são referenciados, **não lidos**. Nenhum `docker inspect` de containers, env, mounts ou IPs foi realizado.

> L32: Diagrama de **vínculos declarados** (subconjunto dos Compose inventariados), não tráfego observado. Os stacks Core Host, Workspace, WhatsApp, Komodo, Traefik e Tailnet requerem inventário próprio.

> L38: - Pendentes: inventário completo dos stacks, `docker compose config --quiet` com ambiente sanitizado, comparação de manifests com runtime, ingress/egress, publicação de portas, least privilege e isolamento por rede.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/OPERACAO.md)

> L3: > **RUNBOOK DE VERIFICAÇÃO, NÃO AUTORIZAÇÃO DE MUDANÇA.** Em 13/11/2026 foram observados 16 containers Up e bridges Syndes/Komodo, sem `docker inspect`, sem leitura de secrets e sem executar Compose. O serviço Up não prova readiness.

> L8: 2. Planejar validação de `docker compose config --quiet` **em cópia isolada** e sem importar arquivos secretos; o manifesto Manager exige variáveis e arquivos operacionais, portanto não executar cegamente no host.

> L9: 3. Com autorização operacional, coletar **somente campos sanitizados** de rede, `internal`, portas publicadas, privilégios, health e labels; nunca registrar env, tokens, mounts privados, IPs privados ou caminhos sensíveis.

> L10: 4. Conferir se topologia efetiva corresponde ao Compose da revisão analisada; testar negativas de comunicação entre domínios em ambiente segregado, com plano de rollback.

> L15: Não existe evidência de isolamento efetivo, rede de produção ou inventário completo de todos os stacks. O job `openfga-migrate` não foi executado. Nenhuma configuração, secret, container, volume, porta ou firewall foi modificado.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
