---
title: "Q07 · Controle de escopo"
description: "Volume Infraestrutura e qualidade · capítulo Q07 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle do escopo, riscos e decisões

**Intervenção Q07 aprovada pelo fluxo deste projeto:** alteração limitada a scripts de planejamento/execução de CI, testes de paridade/impacto e documentação de Q07. Não houve pedido de alteração em segurança, auth, migrations, módulos de domínio, usuários ou produção.

### Causas verificadas e correção

| Causa | Evidência anterior | Correção adotada |
|---|---|---|
| Lista de workflows fixa e obsoleta | Teste exigia apenas três YAML, encontrou cinco; `foundation` falhou | Classificação explícita dos cinco workflows e validação separada dos triggers |
| Risco de aceitar um CI duplicado | Permitidos apenas `syndes-ci.yml` e reutilizáveis como regressão central | Reprovação se novo workflow não classificado; Docs só `push` com paths |
| Ausência de Serviço no planner full | `modules/service-management` tem `package-lock.json` e testes, mas não estava no `catalog` do planner | Registrada suíte `service-management` com impactos CRM/Inbox/Service |
| Serviço sem runner PG17 | `run-suite.sh` não tinha branch `service-management` | Runner com PG17-alpine descartável, label, password sintético, `trap` e npm check/test/pack |
| Atributos de negócio não comprovados | Serviço plugável ainda ausente de `config/modules.json` | **Nenhuma ativação**; suíte local não equivale a rollout |

### Políticas preservadas

- SQL002 continua com índices de bloqueio físico; nenhuma liberação multi-org.
- `foundation` continua obrigatório, e a matriz de paridade mantém asserts de FGA/Keycloak/SQL, browser e infraestrutura.
- Projetos/Docs continuam auxiliares; não foram desabilitados para obter CI verde.
- Não houve desproteção/proteção de `main`, force push, alteração de permissions secrets ou abertura de rede de produto.
- Sem modificação de código/runtime SQL, grants, workers ou dados de clientes.

### Riscos residuais

1. CI remota pode revelar outras falhas de dependência, imagem ou recursos; testar no SHA final antes de declarar `main` saudável.
2. A duração do fan-out aumentou com a nova suíte, mas segurança e cobertura prevalecem sobre velocidade arbitrária.
3. Novos módulos exigem registro em `catalog`, runner, testes/markers e evidências próprios. Não presumir cobertura universal.
4. Status da WBS e da documentação continua **parcial** até execução/verificação e aceite de engenharia.

A auditoria de Q07 só será elevada de **parcial** a **CI validada** após obter run remoto completo e revisão das dependências; a correção local não promove Product Gate do MVP.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/07-controle-do-escopo.md).
