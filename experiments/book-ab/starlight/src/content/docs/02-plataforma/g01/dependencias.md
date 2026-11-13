---
title: "G01 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L12: \| **Integração** \| **Não verificada nesta auditoria** \| G01 não executou testes reais Keycloak/OpenFGA, PostgreSQL tenant A/B ou fluxo de Event Bus \|

> L22: \| `packages/core-kernel/src/module-registry.ts` \| Registro com validação de ID/versão, dependências ausentes e ciclos \| Compatibilidade entre versões em todos os consumidores \|

> L24: \| `modules/core-crm/package.json`, `modules/inbox/package.json`, `modules/whatsapp/package.json` \| Superfícies via `exports`; pacote Inbox = `@syndes/core-inbox` \| Rotas HTTP habilitadas, identidade ou integração \|

> L36: 5. Não se executaram testes de integração, E2E, restore, autorização real ou verificação de deploy nesta revisão; o CI da futura SHA documental também requer checagem separada.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/04-contratos-e-dependencias-publicas.md)

> L12: \| A04 Core Host \| `apps/core-host/src/module-host.ts`, `config/modules.json` \| `loadInstalledPlugins`, módulos confiáveis e validation de dependências/rotas de assets \|

> L17: \| C01/C03/C04/C05 \| ADRs de Control, Keycloak, OpenFGA e OpenBao \| Metadados e identidade, relação/recurso e segredos; contratos de infraestrutura e políticas, não API pública da G01 \|

> L28: **Dependências de G01:** documentos versionados sob `docs/engineering`, catálogo, ADRs e resultados de auditoria dos owners; nenhuma dependência runtime obrigatória identificada para a unidade documental.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L53: - Isolamento real entre Control e Tenant DB, ACL, usuários SQL e Keycloak/OpenFGA, incluindo testes negativos e tenant A/B.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
