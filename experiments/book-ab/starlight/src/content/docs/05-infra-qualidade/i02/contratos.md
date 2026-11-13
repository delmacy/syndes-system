---
title: "I02 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 12/11/2026 (America/Sao_Paulo); coleta live 13/11/2026 02:27 UTC.** Baseline Git `9ac228e8cb21cb37f5c6892063dfdbc3d0238f20`, DevServer01. Foram examinados manifests e metadados do Docker **somente em leitura**. **Não foi realizada inspeção de server02, win1-server, staging nem produção.** Nenhuma senha, IP/hostname privado, URL administrativa, mapeamento de portas nem dados de `docker

> L41: \| Bindings \| Traefik publica portas wildcard; Komodo tem bind em endereço específico; apps observados com loopback ou nenhuma porta publicada; **ACL/firewall não verificados** \|

> L57: **Observações não realizadas:** `docker exec` em bases, consulta a segredo, dump, leitura de mounts/config privada, TLS probing público, firewall, DNS/ACL, acesso a tenant, versionamento de migrações aplicadas, restore e deploy. Não concluir conformidade a partir da ausência dessas verificações.

> L61: **Sem endpoints HTTP próprios da I02 e sem frontend SaaS.** Traefik, Komodo, Keycloak, OpenFGA e Core Host possuem interfaces de seus respectivos produtos/owners. Exposição de proxy não converte APIs privadas em contratos públicos.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **I02 não implementa API HTTP do produto, pacote Node, classes NestJS ou Event Bus.** O contrato de I02 é a **composição versionada de infraestrutura**, seu procedimento aprovado e a rastreabilidade com os owners de dados, identidade, aplicação e segurança.

> L31: - **Público da plataforma:** apenas interfaces versionadas e endpoints explicitamente aprovados por seus owners; Traefik publica rotas autorizadas, não o conteúdo do Control DB.

> L32: - **Interno:** nomes de redes, imagens, mounts, secrets, store IDs e arquivos de Compose são detalhes operacionais, não contratos de módulos SaaS.

> L33: - **Privado:** conteúdos de secrets, binds completos, roteamento administrativo, endereços de host, DSNs e credenciais nunca devem constar em artefatos públicos.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
