---
title: "I02 · Contratos e dependências"
description: "Volume Infraestrutura e qualidade · capítulo I02 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos de infraestrutura e dependências entre owners

**I02 não implementa API HTTP do produto, pacote Node, classes NestJS ou Event Bus.** O contrato de I02 é a **composição versionada de infraestrutura**, seu procedimento aprovado e a rastreabilidade com os owners de dados, identidade, aplicação e segurança.

| Interface de infraestrutura | Fonte e owner | Entrada/saída e boundary |
|---|---|---|
| Docker Compose de PostgreSQL | `infra/postgres/compose.yaml` — I04/I02 | 1 serviço PostgreSQL 17 com volume nomeado, redes de dados e secrets montados por arquivo; não habilita tenant automaticamente |
| Bootstrap de Control/Tenant | `infra/postgres/bootstrap/*` — C01/C02/I04 | SQL e shell de provisionamento autorizados; init só em volume novo, migrations requerem gate próprio |
| Security & Access | `infra/security-access/compose.yaml` — C03/C04/C05 | Keycloak, OpenFGA e OpenBao; store de identidades distinto de DB tenant; trust e secrets verificados externamente |
| Gerador de secrets | `infra/security-access/openbao/run-renderer.sh` | AppRole/TLS e secrets como arquivos em tmpfs; não inserir tokens em variáveis/logs públicos |
| Compose Core Host | `apps/core-host/compose.yaml` — A04 | Imagem declarada de digest/tag aprovado; 3 redes internas e 4 secrets por arquivo; endpoints e events pertencem ao Host |
| Compose Manager | `infra/master-admin/compose.yaml` — A05/A02/Infra | Master API/Web e redes segregadas; **declaração de stack, não instalação confirmada** |
| Gateway WhatsApp | `modules/whatsapp/deploy/compose.yaml` — P03/I09 | Gateway e rede de saída própria; serviço observado ≠ consentimento ou sessão saudável |
| Reverse proxy e administração | Traefik, Tailnet, Komodo — I06/I07/I08 | Entradas HTTPS, ACL, gestão remota, middleware e certificados precisam de verificação no host |
| Backups/restore e release | `scripts/events/*staging*`, `*restore*`, `infra/master-admin/homolog-deploy.sh` — I10/I11/Q08 | Ensaios e gates; não substituir backup/rollback real no ambiente-alvo |
| WBS/Status | [WBS 10.01, 40.09, 95.03](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md) | IDs existentes; atualização do planejamento depende de aceite, não de um container `Up` |

### Requisitos de dependência na inicialização

1. Redes Docker aprovadas (dados, identidade e secretos) e TLS/secret store provisionados por operador.
2. OpenBao unsealed por procedimento autorizado; secret renderer capaz de entregar credenciais em arquivos protegidos.
3. PostgreSQL e databases técnicos preparados; migrations e roles executados com ownership e backup.
4. Keycloak, OpenFGA, stores/clients/tuples válidos; JWT e FGA de tenant não podem ser inferidos de `docker ps`.
5. Core Host com imagem confiável, plugins instalados e acesso mínimo ao Control/Tenant; Workspace/WhatsApp conectados pelo plano de rede adequado.
6. Traefik/Tailnet/Komodo apenas com rotas permitidas e credenciais/ACL separados; monitoramento, backups e ensaios de falha.

**Não há prova de que essa sequência completa tenha sido exercitada no ambiente de produção.** A presença de 16 containers na estação de desenvolvimento não substitui testes funcionais.

### Contratos públicos e privados

- **Público da plataforma:** apenas interfaces versionadas e endpoints explicitamente aprovados por seus owners; Traefik publica rotas autorizadas, não o conteúdo do Control DB.
- **Interno:** nomes de redes, imagens, mounts, secrets, store IDs e arquivos de Compose são detalhes operacionais, não contratos de módulos SaaS.
- **Privado:** conteúdos de secrets, binds completos, roteamento administrativo, endereços de host, DSNs e credenciais nunca devem constar em artefatos públicos.
- **Separação por tenant:** imagem/Host são recursos compartilháveis; o banco e a autorização são isolados. `Control` não é banco de CRM, WhatsApp ou Inbox.
- **Sem promoção cruzada:** criar ou ativar uma rede, role ou container não equivale a ativar módulo no catálogo nem a conceder entitlement.

Mudanças de rede, porta, volume, backup, migration, service user ou proxy exigem escopo, owner e evidência fora desta auditoria de leitura.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/04-contratos-e-dependencias-publicas.md).
