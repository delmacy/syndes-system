# I05 — Docker e redes | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Checkpoint de código `ff37302` incorporado nesta branch como `ab08a0b`; base documental `ec037df`. Evidência: manifests versionados e observação Docker **somente leitura**. **NÃO HOMOLOGADO**: redes, portas, isolamento e regras efetivas não inspecionadas.

## O que foi comprovado

| Dimensão | Evidência | Limite |
|---|---|---|
| PostgreSQL | `infra/postgres/compose.yaml`: imagem `postgres:17-bookworm`, volume `postgres_data`, redes externas `syndes-data`/`syndes-master-data`, healthcheck | Não há prova de backup, restore, grants ou firewall |
| Identidade e segredos | `infra/security-access/compose.yaml`: Keycloak 26.8.1, OpenFGA 1.22.1, OpenBao 2.7.0; rede `syndes-secrets` com `internal: true` | `internal` declarativo não demonstra conectividade ou seal/ACL reais |
| Manager | `infra/master-admin/compose.yaml`: `master-api`, `master-web`, `master-private` interna, `read_only`, `cap_drop: ALL` declarados | Não foi feita inspeção runtime nem ingress |
| Runtime | `docker ps` observou 16 containers Up; `docker network ls` listou bridges Syndes e Komodo | Up não comprova prontidão; redes existentes não comprovam isolamento |
| Cobertura | Três Compose principais inventariados | Core Host, Workspace, WhatsApp, Komodo e demais stacks ainda precisam de mapeamento integral |

**WBS:** I05.DOC.01 — **AUDITORIA PARCIAL** (fontes e ownership); I05.NET.01 — **PENDENTE** (topologia e portas efetivas sanitizadas); I05.SEC.01 — **PENDENTE** (negações/ingress/egress); I05.OPS.01 — **PENDENTE** (compose config, recovery e inventário completo); I05.GATE — **BLOQUEADO** (aceite e prova de ambiente-alvo).

**Limites de ownership:** I05 trata Docker/redes/volumes; I06 Traefik, I07 Tailnet, I08 Komodo, I12 hardening, I04 PostgreSQL e C03/C04/C05 conservam seus contratos. Nenhum container, secret, volume, porta, migration ou configuração foi alterado.

**Próxima unidade:** I06 — Traefik HTTPS. [Referência](REFERENCIA-TECNICA.md) · [Operação](OPERACAO.md) · [Checkpoint](../../evidence/checkpoints/I05-docker-networks-initial-20261113-1000.md).
