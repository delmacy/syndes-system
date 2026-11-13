## 1. Missão, objetivos e fronteiras

### Missão da Q07

Manter um **pipeline coerente para integração ao `main`**, com seleção de regressões por impacto para pull requests e suíte completa em pushes, merge groups e acionamentos manuais, preservando a reprovação quando qualquer gate obrigatório falhar.

| Q07 deve fazer | Q07 não deve fazer |
|---|---|
| Operar um orquestrador central e jobs de paridade reutilizáveis | Criar um pipeline concorrente de regressão por módulo |
| Classificar workflows auxiliares sem confundi-los com PR/merge-group | Apagar publicação Docs ou sincronizador Projects para passar no teste |
| Catalogar suites por módulo, incluindo novo `service-management` | Declarar todos os módulos cobertos apenas porque a matriz é extensa |
| Exigir aprovação efetiva de todos os jobs requeridos | Converter `failure`, `cancelled` ou `skipped` obrigatório em `success` |
| Isolar PG descartável e fixture sintética nos ensaios | Executar migrations ou modificar tenants reais para testar CI |
| Tornar WBS, riscos, scripts e evidências auditáveis por SHA | Declarar release implantado ou Product Gate assinado pelo CI |

### Decisões preservadas

- **Unicidade lógica:** `syndes-ci.yml` é o único workflow que avalia `pull_request` e `merge_group` para regressões gerais. `platform-manager.yml` e `support-browser-e2e.yml` são chamadas reutilizáveis.
- **Workflows auxiliares:** o portal Docs pode ser publicado por push `main` limitado a paths e a sincronização Projects pode responder a `issues`/disparo manual. Eles **não devem duplicar o gate de PR**.
- **Fail closed:** mudanças desconhecidas ou em Core, SQL de tenants, segurança, CI e infraestrutura fazem fan-out para todas as suites instaladas; `noop` não ignora o `foundation`.
- **Segurança:** SQL 002 (single organization/workspace), isolamento SQL, OIDC, OpenFGA e separação Manager/Support continuam gates próprios.
- **Autonomia dos owners:** Q07 altera planner, executor e testes de CI; código, contratos e migrations de `service-management`, CRM, Inbox, WhatsApp e outros módulos permanecem inalterados.

**Estado desta revisão:** correções executadas em worktree isolada, com testes locais concluídos; estado de CI remoto do novo SHA depende da publicação e da execução no GitHub.
