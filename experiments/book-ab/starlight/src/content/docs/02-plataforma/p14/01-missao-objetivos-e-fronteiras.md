---
title: "P14 · Missão e fronteiras"
description: "Volume Plataforma e core · capítulo P14 · matéria 01"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/01-missao-objetivos-e-fronteiras.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 1. Missão, objetivos e fronteiras do Platform Core

### Natureza da P14

O identificador P14 descreve a **fronteira lógica de capacidades transversais**: Identity, Tenancy, Authorization, Resource Registry, Module Registry, Entitlements, Audit, Events, Provisioning e Configuration, conforme `modules/platform-core/AGENTS.md`. Isso é um **mapa de responsabilidades**, não um runtime `platform-core` com controllers, tabelas e serviços próprios.

### Responsabilidades por proprietário

| Unidade real | É responsável por | Não deve assumir |
|---|---|---|
| **P14 — Platform Core** | Regras transversais, integridade do desenho, contrato arquitetural e dependências entre owners | Implementar APIs/SQL de outras unidades só por estar sob o nome “Core” |
| **A08 — Core Kernel** | `@syndes/core-kernel`: interfaces portáveis, `CoreKernel`, `ModuleRegistry`, contratos/versionamento | Falar com PostgreSQL, Keycloak/OpenFGA/OpenBao diretamente ou modelar negócio |
| **A04 — Core Host** | Aplicação NestJS, composition root, adapters, carregamento de plugins confiáveis, rotas e ciclo de vida | Conter regras de CRM/WhatsApp/Inbox ou usar plugins arbitrários da rede |
| **Control Plane/Organizations** | Cadastro de tenant, catálogo, estados de módulos, memberships e provisionamento | Guardar mensagens/eventos de negócio em `syndes_control` |
| **Identity/Authorization/Secrets** | Keycloak OIDC, OpenFGA, OpenBao e permissões de serviço | Permitir fallback em indisponibilidade ou atribuir dados de tenant ao Platform Manager |
| **Módulos `modules/*`** | Domínio, dados, migrations, APIs e contratos públicos próprios | Importar `src/` privado de outros módulos como extensão do Kernel |
| **Infraestrutura** | Deploy, HTTPS, redes, grants, backups, restore e rollbacks | Interpretar um teste descartável como autorização para produção |

### Invariantes normativos

- A identidade é autenticada no Host; o Kernel recebe `Actor` **já verificado**, não JWT.
- O tenant é resolvido por mecanismo confiável e membership server-side. Um tenant ID enviado pelo usuário nunca escolhe DSN/role.
- Autorização de recurso e acesso ao tenant são independentes, com negação segura em falha. A habilitação de módulo requer também `ENABLED`/grants no ponto apropriado.
- Control Plane e dados dos tenants permanecem em databases separados; admin global não recebe leitura do conteúdo dos tenants.
- Composição física de plugin **não equivale** a entitlement do tenant. Um plugin instalado também não comprova que há API/rota exposta ou acesso liberado.
- Eventos exigem contrato versionado, transação confiável e idempotência; os workers de execução automática continuam dependentes de gates.
- Sem plugin marketplace, framework universal de workflows, perfil arbitrário a partir do navegador ou microserviços por antecipação.

### Atores e consumidores

Arquitetos e donos de contrato; desenvolvedores dos módulos; Host/Kernel; equipes de segurança e operação. Uma *platform organization* é distinta da organização cadastrada no CRM. UI pública da P14 não existe; a documentação guia os owners responsáveis.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/01-missao-objetivos-e-fronteiras.md).
