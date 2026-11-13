---
title: "I02 · Controle de escopo"
description: "Volume Infraestrutura e qualidade · capítulo I02 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Divergências, riscos e controle de alterações

| Risco/observação | Evidência | Encaminhamento e owner |
|---|---|---|
| O caminho histórico da unidade é `I02-server02`, mas a unidade é **Hospedagem e ambientes** | Catálogo `I02=infra`; README/STATUS antigos usam server02 | Preservar ID/caminhos/links estáveis; corrigir título e conceito, não renomear diretório |
| Composição local além dos Compose versionados auditados | 8 projetos Compose em execução e 2 containers sem projeto; overlays e manifests no host | Identificar owner/manifests/digest por serviço antes de mover/preparar deploy — I02/I05/owners |
| Mais de um Core Host/Workspace em execução | Host padrão e cutover/preview observados | Conferir roteamento e risco de callbacks duplicados antes de novo release — A04/P03/I06 |
| PostgreSQL de ensaio sem owner/label de descarte | PG17-alpine `Up` ~43h, porta em loopback, sem projeto Compose | Verificar processo e dados, obter autorização explícita para limpeza ou persistência — I05/Q09/owner do teste |
| Manager visual não comprova Manager operacional | Container avulso `healthy`; stack versionada API/Web não observada | Validar Manager API, identidade, separação e caminho de deploy — A02/A05 |
| Health insuficiente para a maioria dos containers | 2 `healthy`, restantes sem healthcheck Docker | Criar matriz de health funcional e probes autorizados; não rotular `unhealthy` sem teste — I05/Q09 |
| Borda Traefik publicada | Binds wildcard e redes de proxy em execução | Auditar HTTPS, ACL, rate limit, exposição e firewall sem publicar rotas — I06/I12 |
| Acesso a host remoto não disponível | `server02`, `win1-server` offline no conector | Registrar `NOT_VERIFIED`, não deduzir que produção está parada — I01/I03/I02 |
| Scripts de init/restore não são prova de aplicação real | SQL bootstrap, runbooks e `scripts/events` presentes | Confirmar migrations, backups, restore e rollback no ambiente autorizado — I04/I10/I11 |
| Documentação pública com informações de hosts | Páginas via GitHub Pages | Usar apenas categoria, versão autorizada e resultado; não anexar `docker inspect`, segredos, endereços ou env |

### Regras de intervenção

- Este checkpoint é **somente leitura** no runtime. Não houve `docker compose up/down`, `docker rm`, `docker network create/rm`, migrations, `git reset` na worktree alheia, abertura de portas ou alteração de logs.
- O fato de um serviço estar `Up` não prova readiness, conectividade do usuário, controle de permissão ou backup.
- Uma porta publicada não é, por si, vulnerabilidade; sem firewall/ACL/TLS testados, seu status é **não verificado**.
- **Sem autorização específica** para remover o PostgreSQL de teste, modificar Traefik ou estabilizar preview/cutover; qualquer mudança deve ter solicitação, owner, rollback e testes.
- `I01` figura **uma única vez** no plano de 57 unidades (posição 48); não existe duplicação de ID a corrigir nesta revisão.

### Checklist de qualidade do inventário

- [x] Confrontados manifests base do Git com containers, redes e volumes do DevServer01.
- [x] Identificados Compose controlados por versão versus overlays locais e recursos avulsos.
- [x] Registrada ausência de leitura de win1/server02 e de staging/prod.
- [x] WBS real vinculada sem promover estados.
- [x] Mantida a separação entre Container Up, health, CI, deploy, rollback e aceite.
- [ ] Aprovação dos owners e auditoria dos hosts remotos.
- [ ] Smoke real de HTTPS/IAM/tenants, restore operacional e segurança.
- [ ] Paridade de configs/imagens, ownership de previews e lifecycle do PostgreSQL de teste.

**Próxima auditoria:** I04 — PostgreSQL. I02 continuará em **auditoria parcial**, não homologação de hospedagem.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/07-controle-do-escopo.md).
