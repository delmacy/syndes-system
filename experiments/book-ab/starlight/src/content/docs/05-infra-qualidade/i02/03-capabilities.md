---
title: "I02 · Capacidades"
description: "Volume Infraestrutura e qualidade · capítulo I02 · matéria 03"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/03-capabilities.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 3. Capabilities de hospedagem verificadas e pendentes

### Observação DevServer01: 12/11/2026 (UTC 13/11 02:27)

| Camada/finalidade | Artefatos no repositório | Evidência live e limites |
|---|---|---|
| Docker/Compose | `infra/*/compose.yaml`, `apps/core-host/compose.yaml` | Docker Engine 29.9.2 e **16 containers Up**; não prova serviço pronto |
| Data plane | `infra/postgres/compose.yaml` | PostgreSQL 17 principal com health **healthy**; **13 redes**, incluindo 3 padrão; DB/roles ainda não auditados |
| Identidade | `infra/security-access/compose.yaml` | Keycloak 26 e OpenFGA presentes; sem healthcheck Docker declarado nesses containers |
| Segredos | `infra/security-access/openbao/` e `compose.yaml` | OpenBao/Raft presente; status de unseal, rotatividade e permissões não verificados |
| Administração/ingress | Manifest de Komodo/Traefik no host (fora do conjunto versionado avaliado) | Komodo Core/Periphery, MongoDB 7 e Traefik 3 ativos; portas de entrada publicadas, autenticação/ACL não homologadas |
| API de aplicação | `apps/core-host/compose.yaml`; overlays WhatsApp | **Duas composições de Core Host** observadas; ownership do tráfego, digest e rotas exigem verificação |
| Front Workspace | `apps/workspace-web` e runbook de desenvolvimento | Workspace, preview e cutover com Nginx; observar serviço ≠ validar sessão/UX |
| Manager global | `infra/master-admin/compose.yaml` | **Frontend visual de preview** healthy, sem label Compose; Master API/Web da stack versionada **não observados nessa coleta** |
| WhatsApp | `modules/whatsapp/deploy/compose.yaml` | Gateway Go/Whatsmeow em execução; estado de sessões e entrega não testados |
| PostgreSQL de ensaio | CI/Q07 e scripts de tests | Um PG17-alpine antigo, em execução há ~43h, sem label de descarte nem projeto Compose; **owner/necessidade não verificados** |
| Redes e volumes | Redes declaradas nas stacks | **13 redes Docker** (3 padrão), **19 volumes** no host, não auditados quanto a conteúdo/restore |
| Segurança da borda | Traefik e redes Docker | Dados e redes dedicadas Manager com `Internal=true`; proxy possui portas publicadas; checar middleware/firewall efetivos |
| Homologação e produção | WBS 95.03; manifests e runbooks | **Nenhum host desses ambientes pôde ser inspecionado**; não afirmar instalação nem saúde |

### Diferença entre três categorias de evidência

- **Declarado:** serviço em Compose, env example, runbook ou WBS. Não implica `docker ps`.
- **Observado:** container `Up`, imagem, redes, health do Docker na coleta. Não comprova API/negativas/backup.
- **Aceito operacionalmente:** smoke real + segurança, restore, release/digest e autorização do responsável. **Não comprovado pela I02 nesta passagem.**

### Atenções observadas

- Containers em **8 projetos Compose** identificáveis e **2 sem rótulo de projeto**, incluindo Manager visual e PG17 de teste.
- Dos 16 containers, apenas **2 relatavam `healthy`** pelo Docker: PostgreSQL principal e Manager visual. Os demais não publicaram healthcheck; não classificar como `unhealthy` por isso.
- O PG17 de ensaio tem porta apenas em loopback, mas não possui marcação de container descartável; falta lifecycle/owner. **Não remover automaticamente.**
- `server02` e `win1-server` estavam **offline no conector**: a ausência de acesso não prova serviço parado.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/03-capabilities.md).
