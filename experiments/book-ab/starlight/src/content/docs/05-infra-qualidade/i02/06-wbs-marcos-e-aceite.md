---
title: "I02 · WBS e critérios de aceite"
description: "Volume Infraestrutura e qualidade · capítulo I02 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS, marcos e critérios de aceite de hospedagem

A [EVOLUÇÃO da I02](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/EVOLUCAO.md) associa a unidade à [WBS mestre](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md). Estados são **históricos**, não transições automáticas provocadas por esta auditoria.

| Tarefa existente | Entregável | Estado histórico da WBS | Situação na auditoria I02 |
|---|---|---|---|
| **10.01** | Inventário real de ambientes, URLs, rede e hosts Control/Tenant | **PEND** | DevServer01 inventariado **parcialmente**; outros hosts offline, sem URLs/ACL/backup validado |
| **40.09** | Homologar origem HTTPS privada, rate limit, SSE e monitoramento do Support | **BLOQ** | Proxy/containers observados, **sem** smoke real, monitoramento ou aceite |
| **95.03** | Staging imutável e promoção por digest | **BLOQ** | Não verificados staging/produção nem imagens/digests de promoção |

### Checkpoint documental 12/11/2026

| Critério de conclusão documental | Evidência obtida | Estado |
|---|---|---|
| Inventário por função e ambiente | Compose versionado + `docker ps/inspect` filtrados | **Parcial (DevServer01)** |
| Separação de responsabilidades | I02 e componentes I01/I03/I04/I05–I08/I12 | **Mapeada, revisão de owner pendente** |
| Segurança de rede | Redes internas, binds classificados, ingress identificado | **Parcial; firewall/TLS/ACL não comprovados** |
| Dados e segredos | Arquitetura dos serviços e volumes | **Declarado + serviços observados; roles/unseal/backup não verificados** |
| Roteamento e réplicas | Host base e cutover/previews coexistem | **Requer classificação de tráfego e digest** |
| Backend/Frontend real | Host, Workspace e Gateway executando | **Containers Up, sem Product Gate** |
| CI do repositório | [run 43350764378](https://github.com/delmacy/syndes-system/actions/runs/43350764378) — 24/24 success no SHA `9ac228e` | **Teste de CI, não deploy do DevServer01** |
| Staging/prod | Nenhum host inspecionado | **Não verificados** |

### Evidência exigida para avançar

1. Para **DevServer01**: registrar responsável por composições locais, manifesto de origem, imagem/digest, versão/branch, serviços extras, health funcional, função preview/cutover e roteamento autorizado.
2. Para **server02/win1**: conectar dispositivo/operador autorizado e coletar **somente leitura**, com foto de versões, volumes/redes, apps, backups e regras de acesso sem segredos.
3. Para **staging**: manifest versionado/digest, isolamento de DB/Keycloak/FGA, restore real de dados sintéticos, certificados, smoke JWT/tenant A-B, rollback.
4. Para **produção**: decisão expressa de implantação, política de backup/restore e RPO/RTO medidos, trilha de auditoria, alertas, rollback, janela e Product Gate.
5. Para a unidade **I02**: revisão do responsável e dos owners I04/I05/I06/I07/I08/I12 sobre fatos e divergências documentadas.

### Ordem subsequente

Próxima unidade documental no plano: **I04 — PostgreSQL**, seguida de Control Plane (C01), Keycloak (C03), OpenFGA (C04) e OpenBao (C05). O diagnóstico de containers e redes mais profundo permanece em **I05/I06/I08** sem promover essas unidades nesta passagem.

**Não marcar 10.01/40.09/95.03 como DONE** apenas pela conclusão documental.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/06-wbs-marcos-e-aceite.md).
