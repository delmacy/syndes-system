---
title: "I02 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L9: \| **Documentação I02** \| **AUDITORIA PARCIAL:** 8 capítulos, ambiente/serviço/owner, topologia, dependências, inventário live sanitizado e WBS reconciliados \| Que os donos de host, segurança, dados e release tenham aprovado \|

> L12: \| **Persistência/segredos** \| PostgreSQL, Keycloak, OpenFGA e OpenBao observados; scripts e volumes versionados/localizados \| Bancos migrados, grants corretos, OpenBao unseal seguro, backup e restore \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L12: \| [`infra/security-access/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/security-access/compose.yaml) \| Keycloak 26, OpenFGA 1 com migrate one-shot, OpenBao 2 com Raft \| C03/C04/C05: identidade, autorização e segredos \|

> L16: \| [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md) \| Ordem de bootstrap, separação Control/Tenant, secrets via OpenBao, roles e grants \| Procedimento normativo; execução real não confirmada \|

> L17: \| [Runbook do DevServer01](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) \| Workspace/Keycloak/Host em desenvolvimento e Compose locais do host \| Snapshot 01/11/2026; pode estar desatualizado \|

> L50: \| Identidade/segurança \| Keycloak 26, OpenFGA 1, OpenBao 2/Raft \| Container em execução não comprova realm, store, políticas nem unseal/recovery \|

> L61: **Sem endpoints HTTP próprios da I02 e sem frontend SaaS.** Traefik, Komodo, Keycloak, OpenFGA e Core Host possuem interfaces de seus respectivos produtos/owners. Exposição de proxy não converte APIs privadas em contratos públicos.

> L64: - **OpenBao:** volume Raft próprio e arquivos de segredo entregues ao runtime segundo política; **não** mapear credenciais para env/Pages.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/04-contratos-e-dependencias-publicas.md)

> L9: \| Security & Access \| `infra/security-access/compose.yaml` — C03/C04/C05 \| Keycloak, OpenFGA e OpenBao; store de identidades distinto de DB tenant; trust e secrets verificados externamente \|

> L10: \| Gerador de secrets \| `infra/security-access/openbao/run-renderer.sh` \| AppRole/TLS e secrets como arquivos em tmpfs; não inserir tokens em variáveis/logs públicos \|

> L21: 2. OpenBao unsealed por procedimento autorizado; secret renderer capaz de entregar credenciais em arquivos protegidos.

> L23: 4. Keycloak, OpenFGA, stores/clients/tuples válidos; JWT e FGA de tenant não podem ser inferidos de `docker ps`.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L34: \| `infra/security-access/compose.yaml` \| Keycloak, FGA migration/API, OpenBao/Raft \| Keycloak, OpenFGA e OpenBao `Up` \| TLS interno, health funcional, realm/store, rotação \|

> L59: - PostgreSQL é **servidor compartilhado**, mas os bancos `Control`, `Keycloak`, `OpenFGA` e tenants são logicamente distintos; `bootstrap` define criação e papéis, não garante aplicação real em volume já existente.

> L60: - OpenBao usa **volume Raft próprio**, fora do PostgreSQL. Komodo usa **MongoDB** como armazenamento da administração de containers, sem se tornar banco do produto.

> L70: - A versão do Docker Engine observada é **29.9.2**; tags principais: PostgreSQL 17, Keycloak 26, OpenFGA 1, OpenBao 2, Traefik 3 e Komodo 2. Versão de imagem não comprova digest imutável nem política de atualização.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
