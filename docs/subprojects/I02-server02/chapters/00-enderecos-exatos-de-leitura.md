## 0. Fontes verificáveis e limites da observação

> **Auditoria I02 — 12/11/2026 (America/Sao_Paulo); coleta 13/11/2026 02:27 UTC.** Base de código: `origin/main` SHA `9ac228e8cb21cb37f5c6892063dfdbc3d0238f20`. Inspeção do **DevServer01** via Docker em modo somente leitura; não houve mudança de container, volume, rede, banco, segredo ou deploy.

| Dimensão | Fonte concreta | Limite |
|---|---|---|
| Owner | `catalog/work-units.json`, ID `I02`, `path=infra` | I02 é infraestrutura/hospedagem; não um app ou tenant |
| Composição declarada | [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md) | Descreve bootstrap e operação-alvo, não comprova serviços ativados |
| Dados | [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) e `bootstrap/*` | PostgreSQL 17, Control/Identity e bancos por tenant previstos; scripts de inicialização não comprovam migrations aplicadas |
| IAM/Secrets | [`infra/security-access/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/security-access/compose.yaml) | Keycloak, OpenFGA e OpenBao/Raft separados |
| Manager | [`infra/master-admin/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/master-admin/compose.yaml) | Declara Manager API/Web segregados; **não observados como essa stack** no DevServer01 |
| Host | [`apps/core-host/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/compose.yaml) | Runtime A04; coexistem composições locais e de cutover |
| WhatsApp | [`modules/whatsapp/deploy/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/deploy/compose.yaml), `devserver01-cutover.compose.yaml` | Gateway e composições de teste/migração; confirmação por ambiente obrigatória |
| Desenvolvimento | [Runbook do DevServer01](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) | Snapshot operacional anterior de Workspace, não uma descrição atual automaticamente |
| Inventário live | `docker version`, `docker ps`, `docker inspect` **filtrado**, `docker network ls/inspect`, `docker volume ls` | **16 containers**, **13 redes** (incluindo padrão), **19 volumes** observados naquele instante; health não equivale a aceite |
| Outros hosts | Estado do conector remoto na coleta | `win1-server` e `server02` **offline**; sem leitura de serviços, staging ou produção |
| Planejamento | [WBS 10.01, 40.09, 95.03](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | PEND/BLOQ históricos, sem Product Gate ou release comprovado |

**Rastreio:** os registros publicados omitem endereços, domínios, portas específicas, bind sources, segredos, tokens e valores de `.env`. Logs e `docker inspect` completos **não devem** ser publicados no GitHub Pages.

**Vínculos:** I01 e I03 são componentes históricos de host sob I02; I04 dados, I05 Docker/redes, I06 Traefik, I07 Tailnet, I08 Komodo, I12 segurança têm owners e auditorias próprios.
