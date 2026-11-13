# I02 — Hospedagem e ambientes | Referência técnica

> **AUDITORIA TÉCNICA PARCIAL — 12/11/2026 (America/Sao_Paulo); coleta live 13/11/2026 02:27 UTC.** Baseline Git `9ac228e8cb21cb37f5c6892063dfdbc3d0238f20`, DevServer01. Foram examinados manifests e metadados do Docker **somente em leitura**. **Não foi realizada inspeção de server02, win1-server, staging nem produção.** Nenhuma senha, IP/hostname privado, URL administrativa, mapeamento de portas nem dados de `docker inspect` integral integram esta página pública.

## Stack, ownership e forma de execução

**I02 não é backend, frontend nem biblioteca:** sua fonte `infra/` reúne configurações e procedimentos de hospedagem, enquanto apps e módulos possuem seus próprios manifests. O nome da pasta `I02-server02` é legado documental, não define o ambiente.

| Fonte versionada | Stack/artefato declarado | Proprietário e limite |
|---|---|---|
| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) | 1 serviço PostgreSQL 17-bookworm, volume de dados, secrets por arquivo, redes de dados e Manager | I04/C01/C02: databases/roles, migrations/tenants separados |
| [`infra/security-access/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/security-access/compose.yaml) | Keycloak 26, OpenFGA 1 com migrate one-shot, OpenBao 2 com Raft | C03/C04/C05: identidade, autorização e segredos |
| [`infra/master-admin/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/master-admin/compose.yaml) | Manager API + web em redes segregadas | A05/A02; configuração declarada **não é Manager implantado** |
| [`apps/core-host/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/compose.yaml) | Core Host NestJS, 3 redes de serviço, 4 secrets por arquivo e imagem aprovada | A04; versão/runtime dependem do deploy e do manifest usado |
| [`modules/whatsapp/deploy/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/deploy/compose.yaml) | Gateway Go/Whatsmeow, dados + rede egress | P03/I09; autorização de canal e sessão precisam de prova própria |
| [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md) | Ordem de bootstrap, separação Control/Tenant, secrets via OpenBao, roles e grants | Procedimento normativo; execução real não confirmada |
| [Runbook do DevServer01](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) | Workspace/Keycloak/Host em desenvolvimento e Compose locais do host | Snapshot 01/11/2026; pode estar desatualizado |
| [`scripts/events`](https://github.com/delmacy/syndes-system/tree/main/scripts/events), [Manager deploy](https://github.com/delmacy/syndes-system/blob/main/infra/master-admin/homolog-deploy.sh) | Ensaios de staging/restore e deploy controlado | Q08/I10/I11; scripts não comprovam backup ou release realizado |

## Ambientes e hospedagem {#ambientes-e-hospedagem}

### Matriz de evidência (por função, não por máquina)

| Ambiente | Host/alcance observado | Stack | Estado comprovável |
|---|---|---|---|
| **Desenvolvimento** | DevServer01 — conector remoto online e Docker consultado | 16 containers em execução; Docker, PostgreSQL, IAM, secretos, Komodo/Traefik, Host, Workspace, WhatsApp, previews | **OBSERVADO em 12/11/2026**, health funcional e Product Gate não homologados |
| **Homologação/staging** | Não foi possível associar host a um release homologado | Existem scripts/Compose/planos de homologação, não prova de instância aprovada | **NÃO VERIFICADO** |
| **Produção** | `server02` e `win1-server` offline no conector nesta coleta; funções não verificadas | Não foi obtido inventário de instalação, versões, bancos, backups ou ingress | **NÃO VERIFICADO** — *offline do conector não comprova servidor parado* |

### Inventário de processos do DevServer01, 12/11/2026

Comandos de coleta executados **somente leitura**: `docker version --format`, `docker ps --format`, `docker inspect` **filtrado em memória para não expor Env/secretos**, `docker network ls/inspect` e `docker volume ls -q`. **Snapshot temporal: não representa estado atual em datas futuras.**

| Indicador | Evidência do instante |
|---|---|
| Docker Engine | 29.9.2 |
| Containers | **16 em estado Up**, distribuídos em **8 projetos Compose** identificáveis e **2 avulsos sem label Compose** |
| Healthchecks | **2 healthy**, sendo PostgreSQL principal e Manager visual; **14 sem indicador Docker health** — *não significa 14 unhealthy* |
| Redes | **13** ao todo (3 Docker padrão); redes de dados/Manager com `internal=true` |
| Volumes | **19 volumes** Docker existentes — conteúdo/recovery não inspecionados |
| Bindings | Traefik publica portas wildcard; Komodo tem bind em endereço específico; apps observados com loopback ou nenhuma porta publicada; **ACL/firewall não verificados** |
| PostgreSQL de teste | PG17-alpine com nomenclatura de ensaio, em execução há ~43h, sem label de descarte nem owner de projeto; loopback; **não limpar automaticamente** |

### Catálogo de serviços observado

| Função | Instâncias vistas | Interpretação |
|---|---|---|
| Borda e gestão | Traefik 3, Komodo Core/Periphery 2, MongoDB 7 | Gestão de containers; não é backend de tenant |
| Persistência de aplicação | PostgreSQL 17-bookworm | Um servidor DB principal observado; databases/roles/restore ainda não validados |
| Identidade/segurança | Keycloak 26, OpenFGA 1, OpenBao 2/Raft | Container em execução não comprova realm, store, políticas nem unseal/recovery |
| Backend de produto | Core Host base e Core Host de cutover WhatsApp | Duas composições presentes; validar owner/roteamento/tráfego e digest |
| Frontend | Workspace Nginx, preview de UI, Workspace de cutover | Preview não equivale a versão comercial |
| Plataforma Manager | Frontend visual avulso **healthy** | API/Web da stack formal de Manager não observadas; evitar confundir visual com painel operacional |
| Canal WhatsApp | Gateway Whatsmeow | Sessão, callbacks e negativas exigem teste de domínio |
| Testes ad hoc | PostgreSQL 17-alpine sem label/projeto | Necessidade/owner desconhecidos; risco de resíduo de ensaio e uso de recursos |

**Observações não realizadas:** `docker exec` em bases, consulta a segredo, dump, leitura de mounts/config privada, TLS probing público, firewall, DNS/ACL, acesso a tenant, versionamento de migrações aplicadas, restore e deploy. Não concluir conformidade a partir da ausência dessas verificações.

## Contratos, interfaces, dados e frontend

**Sem endpoints HTTP próprios da I02 e sem frontend SaaS.** Traefik, Komodo, Keycloak, OpenFGA e Core Host possuem interfaces de seus respectivos produtos/owners. Exposição de proxy não converte APIs privadas em contratos públicos.

- **Control/Manager x Tenant:** múltiplos databases no PostgreSQL principal conforme `infra/README.md`; papéis de menor privilégio e banco individual por tenant, sujeitos a ensaio real pela I04/C01.
- **OpenBao:** volume Raft próprio e arquivos de segredo entregues ao runtime segundo política; **não** mapear credenciais para env/Pages.
- **Docker/Compose:** redes nomeadas e overlays locais; nomes e tags de imagem não garantem digest reprodutível, ausência de drift ou rollback.
- **URLs e rotas:** não publicar. Confirmar TLS/Tailnet/Traefik/ACL/rate limit/identidade em I06/I07/I12, sem confiar somente em Docker network flags.
- **Backup/restore:** existência de volumes e scripts não comprova RPO/RTO; o gate operacional requer teste em staging autorizado.

## Evidências, testes e pendências

- [WBS](EVOLUCAO.md): 10.01 (inventário PEND), 40.09 (homologação HTTPS/rate limit BLOQ), 95.03 (staging imutável BLOQ).
- [CI mainline no SHA de origem](https://github.com/delmacy/syndes-system/actions/runs/43350764378): **24/24 jobs success**, inclusive testes descartáveis de Infra; isso não equivale ao inventário real dos serviços do DevServer01 nem a staging/produção homologados.
- [STATUS](STATUS.md): as-is por dimensão, riscos e próximos owners.
- [Operação](OPERACAO.md): procedimento de inspeção não destrutiva e gates; sem comando para remover containers ou rodar DDL.
- [I01 — DevServer01](../I01-devserver01/OPERACAO.md), [I03 — host auxiliar](../I03-win1-server/OPERACAO.md), [I04 — PostgreSQL](../I04-postgresql/REFERENCIA-TECNICA.md), [I05 — Docker](../I05-docker-e-redes/REFERENCIA-TECNICA.md), [I06 — Traefik](../I06-traefik-https/REFERENCIA-TECNICA.md), [I07 — Tailnet](../I07-tailnet/OPERACAO.md), [I08 — Komodo](../I08-komodo/REFERENCIA-TECNICA.md), [I12 — Segurança do host](../I12-seguranca-de-host/OPERACAO.md).

**Conclusão:** I02 está **parcialmente auditada em desenvolvimento** e não homologada. Sem prova de staging/produção, backup funcional, ingress seguro e ownership dos containers avulsos. O termo `server02` no caminho físico desta página é legado, não o nome do módulo.
