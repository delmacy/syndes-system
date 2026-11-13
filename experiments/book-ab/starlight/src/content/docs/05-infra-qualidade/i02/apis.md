---
title: "I02 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L14: \| **Backend/frontend** \| Core Host principal e de cutover, Workspace, preview e gateway WhatsApp em execução \| API de produção, versão aprovada, owner exclusivo de callbacks ou UX validada \|

> L15: \| **Platform Manager** \| Frontend visual avulso `healthy`; Compose de API/Web encontrado no Git \| Manager completo (API+OIDC+grants) em operação \|

> L26: 5. **P1 — Manager visual ≠ Manager operacional.** Sem observação da stack formal Manager API/Web/identidade neste host; evitar afirmar painel global homologado.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L13: \| [`infra/master-admin/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/master-admin/compose.yaml) \| Manager API + web em redes segregadas \| A05/A02; configuração declarada **não é Manager implantado** \|

> L53: \| Plataforma Manager \| Frontend visual avulso **healthy** \| API/Web da stack formal de Manager não observadas; evitar confundir visual com painel operacional \|

> L61: **Sem endpoints HTTP próprios da I02 e sem frontend SaaS.** Traefik, Komodo, Keycloak, OpenFGA e Core Host possuem interfaces de seus respectivos produtos/owners. Exposição de proxy não converte APIs privadas em contratos públicos.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **I02 não implementa API HTTP do produto, pacote Node, classes NestJS ou Event Bus.** O contrato de I02 é a **composição versionada de infraestrutura**, seu procedimento aprovado e a rastreabilidade com os owners de dados, identidade, aplicação e segurança.

> L11: \| Compose Core Host \| `apps/core-host/compose.yaml` — A04 \| Imagem declarada de digest/tag aprovado; 3 redes internas e 4 secrets por arquivo; endpoints e events pertencem ao Host \|

> L12: \| Compose Manager \| `infra/master-admin/compose.yaml` — A05/A02/Infra \| Master API/Web e redes segregadas; **declaração de stack, não instalação confirmada** \|

> L31: - **Público da plataforma:** apenas interfaces versionadas e endpoints explicitamente aprovados por seus owners; Traefik publica rotas autorizadas, não o conteúdo do Control DB.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L34: \| `infra/security-access/compose.yaml` \| Keycloak, FGA migration/API, OpenBao/Raft \| Keycloak, OpenFGA e OpenBao `Up` \| TLS interno, health funcional, realm/store, rotação \|

> L36: \| `infra/master-admin/compose.yaml` \| API e web em redes segregadas \| Apenas frontend visual avulso `healthy`, não o stack completo \| Identidade Manager, API real, release, isolamento \|

> L74: **I02 não possui frontend ou API de produto.** Workspace/Manager/Support pertencem aos seus aplicativos; as rotas e identidades do Manager e do tenant devem continuar separadas. O que o proxy expõe requer análise com I06 e Segurança, não deve ser deduzido de labels isolados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
