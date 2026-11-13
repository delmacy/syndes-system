## 1. Missão, objetivos e fronteiras da plataforma de testes

### Missão

Fornecer diretrizes, cenários e ferramentas para comprovar **integridade, autorização, isolamento entre tenants, contratos, persistência e recuperação**, antes que produto e operação sejam declarados aceitos. Q01 é um **agrupamento de testes distribuídos**; não é servidor, módulo NestJS, banco, app React ou suíte monolítica.

| Pertence à Q01 | Não pertence à Q01 |
|---|---|
| Política geral de testes em `tests/AGENTS.md` e AGENTS específicos | Alterar regras de domínio/tenancy em CRM, Inbox ou Serviço |
| Organização dos cenários de plataforma/segurança e fixtures sintéticas | Destruir ou migrar banco operacional para produzir evidência |
| Mapear como executar e interpretar provas de PostgreSQL, OpenFGA, OpenBao, Keycloak, Manager, Support e Host | Declarar que scripts representam produção validada ou que UI oculta é autorização |
| Conferir separação de teste estrutural, integração, browser, segurança e carga | Reduzir asserts, desabilitar negações, mascarar flaky tests ou inventar percentuais |
| Exigir rastreabilidade entre SHA, ambiente, comando, resultado e gate | Assinar Product Gate, RC e aceite comercial em nome do owner |
| Tornar visíveis lacunas de implantação e cobertura | Criar um framework central de testes fictício para todas as equipes |

### Invariantes e política existente

- `tests/AGENTS.md`: usar a prova mais barata adequada, sem remover assertions, retries ilimitados, fixtures com secrets reais, ou omitir falha de provider.
- `tests/security/AGENTS.md`: verificação **no backend** de tenant isolation, autorização, ID tampering, autenticidade/idempotência de webhook, session boundary, uploads e ferramentas de IA; uma violação cross-tenant bloqueia release.
- `tests/integration/AGENTS.md`: integração externa usa mock/fake determinístico, exercita erro/timeout, e persistência é validada em DB descartável quando existe.
- `tests/performance/AGENTS.md`: performance em ambiente separado de desenvolvimento/produção; stress por estágios, spike e soak de 2h inicialmente; nunca aceitar degradação de segurança sob carga.
- [Test Strategy](../../../engineering/TEST-STRATEGY.md): gate leve por commit, integração/segurança em PR, stress/restore operacional por RC. **Especificação de teste não equivale a teste realizado.**

**Fronteira técnica:** Q10 é owner de `tests/integrity`, Q07 orquestra GitHub Actions; Q01 organiza o conjunto `tests/`, sem transferir autoria de scripts, migrations ou Product Gates das unidades responsáveis.
