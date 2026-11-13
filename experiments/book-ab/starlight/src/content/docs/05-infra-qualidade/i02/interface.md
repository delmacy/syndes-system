---
title: "I02 · Frontend e interfaces"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Frontend e interfaces

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L14: \| **Backend/frontend** \| Core Host principal e de cutover, Workspace, preview e gateway WhatsApp em execução \| API de produção, versão aprovada, owner exclusivo de callbacks ou UX validada \|

> L15: \| **Platform Manager** \| Frontend visual avulso `healthy`; Compose de API/Web encontrado no Git \| Manager completo (API+OIDC+grants) em operação \|

> L38: **Próximas verificações:** identificar owners de overlays/PG17, coletar inventário somente leitura dos hosts offline quando autorizados e disponíveis, revisar firewall/Traefik, mapear bancos/roles na I04 e assinar aceites operacionais separados. Não tratar os IDs componentes I01/I03/I05/I06/I07/I08/I12 como auditados por esta revisão da I02.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L7: **I02 não é backend, frontend nem biblioteca:** sua fonte `infra/` reúne configurações e procedimentos de hospedagem, enquanto apps e módulos possuem seus próprios manifests. O nome da pasta `I02-server02` é legado documental, não define o ambiente.

> L52: \| Frontend \| Workspace Nginx, preview de UI, Workspace de cutover \| Preview não equivale a versão comercial \|

> L53: \| Plataforma Manager \| Frontend visual avulso **healthy** \| API/Web da stack formal de Manager não observadas; evitar confundir visual com painel operacional \|

> L61: **Sem endpoints HTTP próprios da I02 e sem frontend SaaS.** Traefik, Komodo, Keycloak, OpenFGA e Core Host possuem interfaces de seus respectivos produtos/owners. Exposição de proxy não converte APIs privadas em contratos públicos.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [03-capabilities.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/03-capabilities.md)

> L14: \| Manager global \| `infra/master-admin/compose.yaml` \| **Frontend visual de preview** healthy, sem label Compose; Master API/Web da stack versionada **não observados nessa coleta** \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L36: \| `infra/master-admin/compose.yaml` \| API e web em redes segregadas \| Apenas frontend visual avulso `healthy`, não o stack completo \| Identidade Manager, API real, release, isolamento \|

> L74: **I02 não possui frontend ou API de produto.** Workspace/Manager/Support pertencem aos seus aplicativos; as rotas e identidades do Manager e do tenant devem continuar separadas. O que o proxy expõe requer análise com I06 e Segurança, não deve ser deduzido de labels isolados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
