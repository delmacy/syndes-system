---
title: "P14 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L16: \| **Core Host A04** \| `apps/core-host/src/main.ts`, `module-host.ts`, adapters, `config/modules.json` \| Loader fixo, **sem perfis por instância**. Serviço é dependência mas não plugin instalado \|

> L19: \| **Testes locais históricos** \| Auditoria anterior do checkout `b452a03e`: Kernel **35 PASS**, Host **63 PASS, 19 SKIP** \| Não reexecutados nesta revisão; skips não comprovam PG17/staging/Keycloak/FGA \|

> L37: 1. **CMP-01/02:** matriz de ports/dependências com sign-off e schema de profile validado offline ainda pendentes. A auditoria documental não conclui CMP-01 automaticamente.

> L39: 3. **Serviço Basic:** package `@syndes/service` é dependência do Host, mas não está em `config/modules.json`; módulos precisam ser montados/ENABLED com grants e Product Gate específicos.

> L41: 5. **Testes de integração reais:** resultados históricos com SKIP não servem como aceite de DB, tenant, FGA/Keycloak ou instalação; CI atual só comprova seu próprio SHA.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L11: \| A04 — Core Host \| `apps/core-host/package.json`, `src/main.ts`, `module-host.ts` \| NestJS 12, Node ESM, pg, jose e adapters Control/Keycloak/OpenFGA/OpenBao \|

> L22: \| `CoreKernel` / `start()` \| Inicializa definições com ordem de dependências e sem repetir hooks após rejeição \|

> L25: \| `ModuleRegistry.register/ordered/has` \| SemVer/IDs válidos, schemas únicos, dependências e ordenação; rejeita ciclos/ausentes \|

> L35: `apps/core-host/src/module-host.ts` expõe **internamente** `loadInstalledPlugins()` e `installModuleAssets()`: lê a lista fixa de `config/modules.json` (CRM, Inbox, WhatsApp, Organizations, Support), valida trusted specifiers `@syndes/.../plugin`, dependências/ciclos e rotas duplicadas. `@syndes/service` existe como dependência do Host, **mas não está listado na composição ativa**.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md)

> L10: \| `CoreKernel.start()` \| Inicializa módulos por dependência; falha persistente requer novo Kernel \| Host \|

> L13: \| `ModuleRegistry.register/ordered/has` \| IDs, versões, schemas, dependências, ordem e rejeição de ciclos/ausência \| Host/owners de plugin \|

> L25: \| `module-host.ts` \| `loadInstalledPlugins()` \| Lista estática `config/modules.json`, specifier trusted e validação de dependências antes do Nest \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L27: **P14 não é um processo extra.** A04 importa interfaces de A08 e carrega plugins confiáveis listados em `apps/core-host/config/modules.json`: CRM, Inbox, WhatsApp, Organizations e Support. O pacote `@syndes/service` é dependência de build, mas não está nesse manifesto fixo. A configuração não cria perfis selecionáveis por instância.

> L34: 2. Ordenar definições no `ModuleRegistry`, recusando dependência circular/ausente.

> L36: 4. Receber `Actor` previamente autenticado pelo Host (Keycloak).

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
