---
title: "I06 · Arquitetura, dados e interfaces"
description: "Volume Infraestrutura e qualidade · capítulo I06 · matéria 05"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I06-traefik-https/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 5. Arquitetura, banco, interface, configuração e diagramas

```mermaid
flowchart LR
    Client[Cliente autorizado] --> Ingress[Traefik: configuração ativa pendente de validação]
    Ingress --> RouterAPI[Router Core: /v1/ e /modules/; prioridade 110]
    Ingress --> RouterWeb[Router Workspace: prioridade 2]
    RouterAPI --> Host[Core Host: porta interna 8082]
    RouterWeb --> Web[Workspace: porta interna 80]
```

- Este diagrama representa a intenção das labels, não uma topologia verificada.
- `infra-proxy` é rede Docker externa no Compose; `web` é entrypoint declarado, **não evidência de TLS**.
- Banco de dados, schemas, migrations e lógica de UI: não pertencem ao I06 segundo o inventário atual; frontend atendido é owner Workspace.
- Configuração dinâmica ativa, certificados e políticas não foram inspecionados nesta reconciliação.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I06-traefik-https/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
