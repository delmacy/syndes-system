---
title: "C03 · Missão e fronteiras"
description: "Volume Plataforma e core · capítulo C03 · matéria 01"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/01-missao-objetivos-e-fronteiras.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 1. Missão, objetivos e fronteiras

**Missão observada:** fornecer autenticação OIDC para consumidores Syndes; a decisão de acesso à organização, workspace, módulo e recursos **não** pertence ao Keycloak isoladamente.

**Responsabilidades C03:** serviço Keycloak, configuração runtime obtida por secret e endpoints padrão OIDC do provedor; políticas de identidade e ciclo de credenciais dependem de aprovação operacional.

**Owners consumidores:** A02/A01 controlam interface e PKCE; A05/A06/A04 validam JWT assinado; C01 mantém registro/membership/grants do Control; C04 OpenFGA decide permissões. C03 não é frontend, Core Host, RBAC de negócio, módulo CRM ou instalador de tenants.

**Separação de contexto:** dois fronts por fronteira de confiança (Manager vs Workspace) com clients distintos. O `sub` é identidade imutável e não prova membership, role de operador ou entitlement de módulo.

**Exclusões:** Keycloak não gerencia dados de CRM, mensagens Inbox/WhatsApp, migrations de tenant, grants OpenFGA, usuários de CRM como objetos de negócio nem tabelas Control.

**Status da especificação:** entendimento técnico reconciliado com fontes; requisitos de rotação, logout corporativo e recuperação permanecem **propostas de validação**, não funcionalidades aceitas.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/01-missao-objetivos-e-fronteiras.md).
