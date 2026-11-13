---
title: "I02 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L15: \| **Platform Manager** \| Frontend visual avulso `healthy`; Compose de API/Web encontrado no Git \| Manager completo (API+OIDC+grants) em operação \|

> L18: \| **CI do código auditado** \| [Run 43350764378](https://github.com/delmacy/syndes-system/actions/runs/43350764378) **24/24 jobs success** no SHA `9ac228e` \| Deploy, DR, homologação ou aceite de produção \|

> L28: 7. **P1 — continuidade.** Contagem de 19 volumes, arquivos SQL e scripts de restore não certificam RPO/RTO, backup, migrações ou rollback de produção.

> L36: \| 95.03 \| Staging imutável, deploy por digest e rollback \| **BLOQ** \| Provar staging, backup/restore, releases imutáveis e reversão \|

> L43: - [Operação](OPERACAO.md): comandos **somente leitura**, restrições para segredos e gates.

> L45: - **Não foi executado:** deploy, migração, dump/restore, restart, cleanup, leitura de dados/segredos, alteração de firewall, Komodo, Traefik, serviço ou branch alheia.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L13: \| [`infra/master-admin/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/master-admin/compose.yaml) \| Manager API + web em redes segregadas \| A05/A02; configuração declarada **não é Manager implantado** \|

> L14: \| [`apps/core-host/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/compose.yaml) \| Core Host NestJS, 3 redes de serviço, 4 secrets por arquivo e imagem aprovada \| A04; versão/runtime dependem do deploy e do manifest usado \|

> L15: \| [`modules/whatsapp/deploy/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/deploy/compose.yaml) \| Gateway Go/Whatsmeow, dados + rede egress \| P03/I09; autorização de canal e sessão precisam de prova própria \|

> L18: \| [`scripts/events`](https://github.com/delmacy/syndes-system/tree/main/scripts/events), [Manager deploy](https://github.com/delmacy/syndes-system/blob/main/infra/master-admin/homolog-deploy.sh) \| Ensaios de staging/restore e deploy controlado \| Q08/I10/I11; scripts não comprovam backup ou release realizado \|

> L57: **Observações não realizadas:** `docker exec` em bases, consulta a segredo, dump, leitura de mounts/config privada, TLS probing público, firewall, DNS/ACL, acesso a tenant, versionamento de migrações aplicadas, restore e deploy. Não concluir conformidade a partir da ausência dessas verificações.

> L65: - **Docker/Compose:** redes nomeadas e overlays locais; nomes e tags de imagem não garantem digest reprodutível, ausência de drift ou rollback.

> L74: - [Operação](OPERACAO.md): procedimento de inspeção não destrutiva e gates; sem comando para remover containers ou rodar DDL.

> L75: - [I01 — DevServer01](../I01-devserver01/OPERACAO.md), [I03 — host auxiliar](../I03-win1-server/OPERACAO.md), [I04 — PostgreSQL](../I04-postgresql/REFERENCIA-TECNICA.md), [I05 — Docker](../I05-docker-e-redes/REFERENCIA-TECNICA.md), [I06 — Traefik](../I06-traefik-https/REFERENCIA-TECNICA.md), [I07 — Tailnet](../I07-tailnet/OPERACAO.md), [I08 — Komodo](../I08-komodo/REFERENCIA-TECNICA.md), [I12 — Segurança do host](../

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

> L18: - **Runbook específico:** [DevServer01](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) é histórico; inventário de runtime e lacunas estão na [Referência técnica](REFERENCIA-TECNICA.md). Não reutilizar comandos de deploy de snapshot antigo por inferência.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

> L39: - **Desenvolvimento:** [I01 — DevServer01](../I01-devserver01/OPERACAO.md) e seu [runbook](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md).

> L40: - **Hospedagem por ambiente:** [I02 — inventário e STATUS](STATUS.md) e [I03 host auxiliar](../I03-win1-server/OPERACAO.md). **Não foi comprovado** que I03 ou server02 sejam staging ou produção.

> L41: - **Ferramentas:** [Docker](../I05-docker-e-redes/REFERENCIA-TECNICA.md), [Traefik](../I06-traefik-https/REFERENCIA-TECNICA.md), [Tailnet](../I07-tailnet/OPERACAO.md) e [Komodo](../I08-komodo/REFERENCIA-TECNICA.md).

> L42: - **Dados e resiliência:** [PostgreSQL](../I04-postgresql/REFERENCIA-TECNICA.md), [Backup/Restore](../I10-backup-e-restore/OPERACAO.md), [Release/Rollback](../I11-release-e-rollback/OPERACAO.md).

> L48: 1. Confirmar host, ambiente, autorização de consulta, data/hora e SHA do checkout do repositório; **não** inferir deploy pelo Git.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L37: \| `modules/whatsapp/deploy/compose.yaml` \| Gateway com rede de egress \| Gateway observado `Up` \| Sessão, callbacks, ownership do canal, idempotência \|

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/06-wbs-marcos-e-aceite.md)

> L21: \| CI do repositório \| [run 43350764378](https://github.com/delmacy/syndes-system/actions/runs/43350764378) — 24/24 success no SHA `9ac228e` \| **Teste de CI, não deploy do DevServer01** \|

> L28: 3. Para **staging**: manifest versionado/digest, isolamento de DB/Keycloak/FGA, restore real de dados sintéticos, certificados, smoke JWT/tenant A-B, rollback.

> L29: 4. Para **produção**: decisão expressa de implantação, política de backup/restore e RPO/RTO medidos, trilha de auditoria, alertas, rollback, janela e Product Gate.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
