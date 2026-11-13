## 2. Requisitos, histórias e casos de uso dos Quality Gates

Os exemplos são derivações das fontes existentes, não criação de novas features ou aprovação de critérios numéricos.

### Matriz de critérios por risco

| Critério existente | Cenário/ator | Evidência obrigatória |
|---|---|---|
| Estrutura obrigatória | Engenheiro altera pacote ou catálogo | `tests/integrity/repository-structure.sh` e `check-work-units.mjs` por SHA |
| Sem regressão de contratos | Owner altera export, API HTTP ou eventos | Teste de contrato, dependentes e compatibilidade executados no mesmo SHA |
| Tenant isolation e autorização | Usuário A, B, anônimo e outros OIDC clients | Testes negativos reais com DB, Keycloak/OpenFGA e fronteiras de recurso |
| Integridade de dados | Executor aplica migration/consumer | Banco descartável versionado, rollback/replay e semântica transacional |
| UX operável | Usuário real do Workspace/Manager/Support | Navegador autenticado, loading/erro/403, fluxo E2E, acessibilidade |
| Falha segura | Operador enfrenta indisponibilidade de serviço | Denegação segura, logs sanitizados e recuperação com evidência |
| Release candidate | Responsável avalia produção | CI verde do SHA, stress/spike/soak, backup/restore real, digest e rollback |
| Aceite | Produto + engenharia/segurança + operação | Decisão humana vinculada ao requisito, ambiente e artefato |

### Histórias documentais

- **US-Q10-A:** como revisor, quero saber quais suites foram realmente executadas e quais foram `skipped`, para não interpretar uma matriz planejada como qualidade comprovada.
- **US-Q10-B:** como engenheiro, quero que mudanças de contratos e componentes compartilhados forcem testes de consumidores, para detectar regressões além do módulo alterado.
- **US-Q10-C:** como operador de release, quero ligar digest, migrações, restore, smoke e rollback ao mesmo release para impedir promoção insegura.
- **US-Q10-D:** como QA, quero reproduzir negações cross-tenant e acesso de OIDC client errado para comprovar fronteiras.

### Casos de uso

**UC-Q10-01 — Pull Request:** identificar base/head → planner decide suites por impacto → foundation valida a estrutura → suites executam → paridades requeridas são verificadas → gate aprova somente quando todos os obrigatórios tiverem sucesso. Uma falha em foundation **bloqueia**, não pode ser compensada por publicação do Docs.

**UC-Q10-02 — Migração de tenant:** conferir owner e versão → banco descartável com migrations e negações → ensaio restaurável → plano de ativação aprovado → backup/restore operacional quando necessário → smoke e observabilidade. Um ensaio de dump sintético não autoriza DDL real.

**UC-Q10-03 — Release/Go-live:** conferir Product Gate do módulo → SHA/digest → identidade/políticas → cobertura do cenário com navegador/DB reais → backup/restore → rollback e aprovação da janela → evidência de implantação → aceite. Todos são **etapas independentes**.

### Invariantes de segurança

Cross-tenant leak = 0, unauthorized access = 0, corrupção = 0 e perdas silenciosas de mensagens = 0, conforme `AGENTS.md`. **Não** definir metas numéricas de latência, RPO/RTO, cobertura ou capacidade do servidor que ainda não tenham baseline e evidência por ambiente.
