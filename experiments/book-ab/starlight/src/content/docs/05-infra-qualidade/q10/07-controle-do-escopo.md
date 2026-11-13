---
title: "Q10 · Controle de escopo"
description: "Volume Infraestrutura e qualidade · capítulo Q10 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle de escopo, divergências e riscos

**Esta atualização não altera gates executáveis, main, proteção de branch, migrations, jobs, ambientes nem suites de outro owner.** Reconcilia fontes observadas.

### Divergências abertas

| Falha/risco identificado | Owner correto | Encaminhamento |
|---|---|---|
| Mainline CI falha no teste de paridade de workflows no SHA `69670e2` | Q07 | Diagnóstico e correção em frente separada; não enfraquecer a prova |
| Teste estrutural de Q10 não cobre semântica de negócio | Q02/Q03/Q04/Q05 e módulos | Usar suites próprias e gates conforme risco |
| Planner de suites não lista explicitamente todos os módulos futuros/novos | Q07 e owner de cada módulo | Verificar cobertura por mudança/contract; não garantir que `full` cobre todo código |
| Testes PG/Keycloak/OpenFGA sintéticos confundidos com operação | QA, Segurança, Infra, Operação | Estado de prova por ambiente e SHA; restore operacional em gate separado |
| Definition of Done e Product Gate dissociados | Q10/G02 e responsáveis | Matriz de requisitos, evidências, aceites por unidade e release |
| WBS histórica versus CI/Project/STATUS | G03/Q10 e owners | Link para fonte correta, sem estados de progresso duplicados |
| Pressão por CI verde a qualquer custo | Q07/QA | Bloquear solução que pule suites, remova assertivas ou normalize falha como sucesso |
| Segurança e configuração pública | Segurança/Infra | Não publicar credenciais, DSNs, IPs privados, logs com PII ou política operacional sensível |

### O que foi feito e o que não foi

**Feito:** leitura estática do checkout, documentação de responsabilidades, matriz de gatilhos/gates, critérios de evidência, registro de bloqueios e STATUS. **Não feito:** build ou testes do produto, validação de DB real, autorização E2E, restore operacional, implantação de artefatos, tuning de performance, aprovação humana de gate e publicação de segredos.

A auditoria Q10 ficará **parcial** até validação das políticas, CI saudável, cobertura de suites e evidências dos owners. A continuidade documental encaminha Q07; não cria automaticamente uma nova sprint de CI nem altera cronograma.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/07-controle-do-escopo.md).
