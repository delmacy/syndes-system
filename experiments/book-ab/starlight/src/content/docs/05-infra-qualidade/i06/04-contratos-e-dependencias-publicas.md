---
title: "I06 · Contratos e dependências"
description: "Volume Infraestrutura e qualidade · capítulo I06 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I06-traefik-https/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos e dependências públicas

- Router `syndes-core-whatsapp-v2`: Host e prefixos `/v1/`/`/modules/`, prioridade 110, `web`, upstream interno 8082.
- Router `syndes-workspace-whatsapp-v2`: Host sem prefixo, prioridade 2, `web`, upstream 80.
- Ambos referenciam `syndes-tailnet-only@docker` e `infra-proxy`, exigindo middleware/provider/rede já existentes.
- **Não declarar contrato HTTPS ativo apenas pelo nome I06**; nenhum evento versionado, SDK ou API de negócio I06 identificado.
- Origem: `modules/whatsapp/deploy/devserver01-cutover.compose.yaml`; detalhamento em [Referência técnica](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I06-traefik-https/REFERENCIA-TECNICA.md).


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I06-traefik-https/chapters/04-contratos-e-dependencias-publicas.md).
