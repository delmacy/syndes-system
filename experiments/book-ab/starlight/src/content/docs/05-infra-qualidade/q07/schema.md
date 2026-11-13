---
title: "Q07 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)

> L15: \| **Release/Produto/Operação** \| **Não verificados:** alteração de seleção CI não habilita P05 nem libera migrations, grant, deploy, backup/restore ou Product Gate \|

> L22: \| Unicidade de regressão \| Teste rejeitava Docs Pages por ter `push` escopado \| Mantém central exclusivo em PR/merge group e Docs/Projects como auxiliares \| Manutenção das assertions de OIDC/FGA/SQL, paridades e gate \|

> L33: 5. **Segurança:** nenhum tenant operacional, migrations de produção, grant, porta pública ou secret foi alterado nesta frente.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/REFERENCIA-TECNICA.md)

> L42: Q07 **não possui frontend, schema SQL ou migration próprios**. GitHub Actions e Syndes Docs são as interfaces de acompanhamento; o PG17 da suite Serviço é temporário e não substitui tenant real. Não publicar dados sensíveis, tokens, endpoints administrativos nem senhas de ambientes operacionais.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Q07 não mantém API HTTP, schema PostgreSQL, controller, port NestJS nem eventos de negócio**. Seus contratos executáveis são **comandos, JSON de planejamento, YAML de CI e exit codes**, consumidos pelo GitHub Actions.

> L35: **Fronteira de código:** Q07 pode alterar scripts/workflows de CI e seus testes. As assinaturas `ServiceFunnelService`, `InboxService`, Core, schema `service` e endpoints continuam pertencendo aos módulos. A seleção de teste **não habilita** um módulo operacional.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L43: 5. **Release não é CI.** Para ativação real de Serviço, faltam grants, Control ENABLED, backup/restore, SQL operacional, tenant autorizado e Product Gate.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
