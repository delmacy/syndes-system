# Syndes System

Plataforma SaaS modular e multi-tenant em desenvolvimento. A **`main` é a linha canônica de código integrado**; branches de trabalho são temporárias. Uma funcionalidade estar no código da `main` **não** significa que tenha sido implantada ou homologada em produção.

## Estado do código — 09/11/2026

Após a consolidação da [PR #47](https://github.com/delmacy/syndes-system/pull/47), a `main` contém a fundação do **Core Kernel**, **Core Host**, **Organizations/Workspace**, **CRM**, **Inbox**, **WhatsApp** (contratos TypeScript e gateway Go), **Syndes Support** e **Platform Manager** (API e frontend segregados). A integração também mantém suites automatizadas para contratos, isolamento entre tenants, autorização, PostgreSQL, Keycloak, OpenFGA, OpenBao e testes de navegador.

Esse é o estado do **repositório de desenvolvimento**. Não significa que todas as jornadas estejam aceitas, que o multi-org esteja ativado nem que Support/Platform Manager tenham sido liberados em operação real. O **Product Gate #31** continua mantendo a trava SQL 002. Os releases operacionais possuem requisitos específicos.

### Direção do MVP

O escopo aprovado continua sob controle: classificar qualquer nova demanda como `BLOCKER`, `BUG`, `MVP` ou `POST-MVP`. Priorizar o produto utilizável e a integração das áreas existentes, não criar novas frentes desnecessárias. O próximo trabalho funcional depende de aceite explícito por módulo.

A ordem originalmente planejada abrange CRM, Inbox, WhatsApp, Agendamento, Assistente IA N1, Documentos, Email, Onboarding, Billing, Website Comercial e Release Candidate. Essa ordem é **roadmap**, não declaração de funcionalidades concluídas.

## Fluxo de engenharia: sempre para main

1. Partir da `main` atual; preferir PRs curtos e integrá-los rapidamente. Evitar cadeias permanentes de branches.
2. Executar o **Syndes Mainline CI**: `.github/workflows/syndes-ci.yml` orquestra testes impactados no PR e testes completos no push da `main`; as suítes reais de Support e Platform Manager permanecem reutilizáveis pelo orquestrador.
3. O check agregado `Syndes CI Gate` informa o estado da validação. **A main está intencionalmente sem branch protection administrativa durante esta fase**, por decisão do proprietário. Revisões obrigatórias e restrições administrativas serão consideradas posteriormente, não antecipadas por agentes.
4. Produção é uma decisão separada: release rastreável por SHA/digest, staging, smoke, backup, rollback e aceite operacional. Merge não dispara autorização irrestrita de deploy.

A política detalhada está em [MAINLINE-CI-POLICY.md](docs/engineering/MAINLINE-CI-POLICY.md). A [Issue #38](https://github.com/delmacy/syndes-system/issues/38) acompanha consolidação histórica e pendências. PRs históricos já absorvidos foram encerrados sem excluir branches; alterações ainda não integradas continuam separadas.

## Estrutura

- `packages/core-kernel/`: contratos e inicialização modular
- `apps/core-host/`: APIs, autenticação, autorização e composição dos módulos
- `modules/`: CRM, Inbox, WhatsApp, Organizations, Support e demais contratos de produto
- `apps/workspace-web/`: interface de operação de clientes/tenants
- `apps/support-web/`: interface segregada da central de atendimento Syndes
- `apps/master-admin-api/` e `apps/master-admin-web/`: APIs e frontend segregados do Platform Manager
- `infra/`: bancos, identidade, segredos e manifests de infraestrutura
- `scripts/ci/`, `tests/` e `.github/workflows/`: planejador, suites e gates automatizados
- `docs/`: PRDs, ADRs, WBS, critérios de aceite e runbooks

## Documentos fundamentais

- [Contrato global de engenharia](AGENTS.md)
- [Estratégia de testes](docs/engineering/TEST-STRATEGY.md)
- [Política de integração mainline](docs/engineering/MAINLINE-CI-POLICY.md)
- [Candidato integrado e evidências](docs/engineering/INTEGRATED-RELEASE-CANDIDATE-20261109.md)
- [Product Gate multi-organização #31](https://github.com/delmacy/syndes-system/issues/31)
- [Release Gate Syndes Support](docs/engineering/SYNDES-SUPPORT-RELEASE-GATE.md)
- [Release Gate Platform Manager](docs/engineering/PLATFORM-MANAGER-RELEASE.md)

**Princípio:** `IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`. A `main` contém a integração técnica; os gates operacionais continuam independentes.
