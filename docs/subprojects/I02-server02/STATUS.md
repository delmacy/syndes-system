# I02 — Hospedagem e ambientes | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 12/11/2026 (America/Sao_Paulo).** Fonte Git `origin/main` SHA `9ac228e8cb21cb37f5c6892063dfdbc3d0238f20`; DevServer01 consultado via conector remoto e Docker **somente leitura** em 13/11/2026 02:27 UTC. `win1-server` e `server02` estavam **offline no conector**, portanto **staging e produção não foram verificados**. Nenhuma intervenção operacional foi autorizada ou executada.

## Estado multidimensional (sem percentuais de conclusão)

| Dimensão | Situação e evidência | Não permite concluir |
|---|---|---|
| **Documentação I02** | **AUDITORIA PARCIAL:** 8 capítulos, ambiente/serviço/owner, topologia, dependências, inventário live sanitizado e WBS reconciliados | Que os donos de host, segurança, dados e release tenham aprovado |
| **DevServer01** | **OBSERVADO:** Docker Engine 29.9.2, **16 containers Up**, **8 projetos Compose**, **2 avulsos**, **13 redes** (3 padrão), **19 volumes** | Que esteja homologado, com serviços/segurança/backup funcionando |
| **Saúde de containers** | PostgreSQL 17 principal e Manager visual relatavam **healthy**; **14 containers sem healthcheck Docker** | Que os 14 estejam unhealthy ou que os 2 tenham Product Gate |
| **Persistência/segredos** | PostgreSQL, Keycloak, OpenFGA e OpenBao observados; scripts e volumes versionados/localizados | Bancos migrados, grants corretos, OpenBao unseal seguro, backup e restore |
| **Roteamento/proxy** | Traefik e redes Docker encontrados; entradas publicadas e segmentos `internal=true` identificados | TLS/ACL/firewall, proteção do Manager ou roteamento de previews corretos |
| **Backend/frontend** | Core Host principal e de cutover, Workspace, preview e gateway WhatsApp em execução | API de produção, versão aprovada, owner exclusivo de callbacks ou UX validada |
| **Platform Manager** | Frontend visual avulso `healthy`; Compose de API/Web encontrado no Git | Manager completo (API+OIDC+grants) em operação |
| **Container de ensaio** | PostgreSQL 17-alpine `Up` há ~43h, sem label de descartável ou projeto Compose | Que pode ser eliminado sem impacto; requer identificar owner |
| **Staging/produção** | **NÃO VERIFICADOS**: conectores de `server02` e `win1-server` offline | Que os hosts estejam inativos, sem software ou sem dados |
| **CI do código auditado** | [Run 43350764378](https://github.com/delmacy/syndes-system/actions/runs/43350764378) **24/24 jobs success** no SHA `9ac228e` | Deploy, DR, homologação ou aceite de produção |

## Divergências e riscos priorizados

1. **P0 documental — mapa de ambientes incompleto.** Somente DevServer01 foi inspecionado; não vincular sem evidência `server02` ou `win1-server` a staging/produção.
2. **P1 operacional — composições locais e overlays.** Dois Core Hosts, duas variantes de Workspace, previews e projetos com manifests fora do conjunto versionado auditado exigem owner, imagem/digest, função e rota validados antes de release.
3. **P1 — container PostgreSQL de teste sem lifecycle claro.** PG17-alpine avulso, `Up` há ~43h, sem label de descarte. Investigar owner e dados antes de limpeza; **não apagar nem migrar automaticamente**.
4. **P1 — borda e segurança de hosts.** Traefik com bindings publicados e Komodo em endereço específico: exposição real depende de firewall/ACL/HTTPS; exigir teste em I06/I12.
5. **P1 — Manager visual ≠ Manager operacional.** Sem observação da stack formal Manager API/Web/identidade neste host; evitar afirmar painel global homologado.
6. **P1 — health insuficiente.** 14 containers sem healthcheck Docker; definir probes específicos em I05/Q09, sem retirar serviços ou criar monitoramento verboso sem escopo.
7. **P1 — continuidade.** Contagem de 19 volumes, arquivos SQL e scripts de restore não certificam RPO/RTO, backup, migrações ou rollback de produção.

## WBS e critérios de próximo aceite

| Referência | Origem | Estado preservado | Ação para fechar o gate |
|---|---|---|---|
| 10.01 | WBS programa — inventário de ambientes Control/Tenant | **PEND** | Obter os hosts/serviços restantes e revisar paridade, rede, digest, secret e backup |
| 40.09 | Homologação HTTPS, SSE, rate limit e monitoramento de Support | **BLOQ** | Smoke real, ACL/TLS, tenant A/B, logs sanitizados e aprovação |
| 95.03 | Staging imutável, deploy por digest e rollback | **BLOQ** | Provar staging, backup/restore, releases imutáveis e reversão |

**Próximas verificações:** identificar owners de overlays/PG17, coletar inventário somente leitura dos hosts offline quando autorizados e disponíveis, revisar firewall/Traefik, mapear bancos/roles na I04 e assinar aceites operacionais separados. Não tratar os IDs componentes I01/I03/I05/I06/I07/I08/I12 como auditados por esta revisão da I02.

## Escopo e evidências da entrega

- [Especificação / diagramas](ESCOPO.md) e [Referência técnica](REFERENCIA-TECNICA.md): fontes normativas, comparação declarado/observado e lacunas.
- [Operação](OPERACAO.md): comandos **somente leitura**, restrições para segredos e gates.
- [Evolução/WBS](EVOLUCAO.md): tasks históricas, sem promoções automáticas.
- **Não foi executado:** deploy, migração, dump/restore, restart, cleanup, leitura de dados/segredos, alteração de firewall, Komodo, Traefik, serviço ou branch alheia.

| Data/hora da observação | Fonte | Resultado | Restrições |
|---|---|---|---|
| 2026-11-12 23:27 America/Sao_Paulo (13/11 02:27 UTC) | DevServer01, metadados Docker e manifest Git `9ac228e` | 16 Up, 8 Compose, 2 avulsos, 13 redes, 19 volumes | Evidência de desenvolvimento, não homologação |
| 2026-11-12 | Consulta do conector de dispositivos | win1/server02 offline | Indisponibilidade do conector não prova estado do host |
| 2026-11-12 | [GitHub Mainline](https://github.com/delmacy/syndes-system/actions/runs/43350764378) | 24/24 jobs success no SHA `9ac228e` | CI de código, não estado operacional |

**Status final:** auditoria parcial com evidência real do DevServer01; homologação/staging/produção **não verificados**.
