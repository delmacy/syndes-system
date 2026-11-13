---
title: "Q10 · Capacidades"
description: "Volume Infraestrutura e qualidade · capítulo Q10 · matéria 03"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/03-capabilities.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 3. Capabilities de qualidade identificadas

| Capability | Owner/fonte | Observação da auditoria |
|---|---|---|
| Teste estrutural de repositório e AGENTS | **Q10:** `tests/integrity/repository-structure.sh`, `tests/integrity/AGENTS.md` | Arquivo executável identificado, comandos de checagem presentes; não substitui demais testes |
| Verificação de catálogo | `scripts/architecture/check-work-units.mjs` | Executada pelo teste estrutural, revalida ownership e estrutura |
| Seleção de testes por impacto | **Q07:** `scripts/ci/plan.mjs` e `.github/workflows/syndes-ci.yml` | Modo `full` no main; `foundation` é always-on |
| Paridade e regressão | **Q07/owners:** `scripts/ci/parity.test.mjs`, `run-suite.sh` | **Falha observada** no run do SHA auditado; gate global bloqueado |
| Unidades de domínio | **Q02** e owners de `modules/*` | Suites unitárias e build específicos, nem todos cobertos pelo runner central |
| Contratos/integração e PG descartável | **Q03**, módulos, `tests/integration` | Evidência local/descartável não é produção |
| Browser E2E | **Q04**, A01–A03 | Testes de sessão, negações cross-tenant e público real requerem ambiente |
| Segurança | **Q05**, `tests/security` | Testes de autorização e segurança não podem ser substituídos por menu condicional |
| Infra e release | **Q09/Q08**, `infra`, scripts de operação | Saúde, migrations, imagens, restauração e rollback dependem do ambiente |
| Performance | **Q06**, `tests/performance` | Stress/spike/soak e recursos controlados previstos para RC |
| Go-live comercial | Produto/operador | Aceite externo, operação e conformidade não são produzidos por Q10 automaticamente |

**Não existe uma API de “qualidade aprovada” que possa substituir os evidências.** A Q10 é unidade de teste/critério; os estados são independentes: **requisito aprovado → código → testes locais → CI → integração → deploy → homologação**, com provas distintas.

### Lacunas no checkout analisado

- O planner central enumera suites para Kernel/Host, Organizations, CRM, Inbox, WhatsApp, Workspace, Support, Manager, Account Access e Infra; a presença de outros módulos como `service-management` **não comprova** que exista suite correspondente no catálogo principal.
- A validação `repository-structure.sh` confere arquivos obrigatórios, AGENTS e work-units; não executa testes de negócio.
- O CI do SHA `69670e2` falha em paridade, impedindo regressão completa no gate.
- Não foram auditados nesta frente deploy, ambiente real de Keycloak/OpenFGA, dados de clientes, smoke de produção, backups e restore reais.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/03-capabilities.md).
