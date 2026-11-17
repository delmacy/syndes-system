# P02-ASSIGN-02 — Ensaio pré-homologação via GitHub Actions

> **16/11/2026 · código de base `1666f86`.** Escopo **exclusivamente de testes e documentação**, sem acesso ao DevServer01, sem migração ou saneamento de dados produtivos e sem ativar grants no ambiente real. Resultado do ensaio registrado abaixo na SHA `df6424c`, sem desbloqueio automático de rollout.

## Evidência positiva — GitHub Actions

**Evidência da execução:** [Mainline run 43968388949](https://github.com/delmacy/syndes-system/actions/runs/43968388949), commit `df6424c`, job **Regression / inbox: SUCCESS**. Logs: `npm test` 35 PASS; PostgreSQL `pg-org-scope` 1 PASS, `pg-integration` 1 PASS, `pg-assignment-races` 1 PASS, Host HTTP 9 PASS; novo `pg-assignment-preflight` 1 PASS (fixture: 5 linhas, 1 elegível, 4 inválidas, rollback); novo `fga-assignment-preflight` **5 PASS / 0 FAIL** (modelo OpenFGA real, memória, grants sintéticos e revogação). **Não é evidência de instalação em servidor, Keycloak real no Inbox, FGA individual do destinatário integrado ao P02 ou execução em dados de clientes.**

## Objetivo e decisões que faltam

Confrontar a regra já implementada em `P02-ASSIGN-01` com os pré-requisitos de um rollout seguro antes de executar a implementação completa de IAM/histórico:

1. **Readiness PostgreSQL/P04:** migrations de ownership 001/002/003, índices de single-org e recibo de backfill por tenant devem ser verificados por ambiente antes de qualquer promoção. Verificação na fixture **não prova** instalação no Tenant DB real.
2. **Histórico de atribuições:** emitir relatório agregado (somente contagens por motivo) de `assigned_to` cuja membership ou scope não é elegível. A consulta é **SELECT** e não converte automaticamente responsáveis antigos para NULL, não notifica clientes e não altera trilha de auditoria. A decisão de recuperação depende do proprietário.
3. **Identidade e autorização:** P04 `admin/editor` ativo é apenas um sinal de elegibilidade. O destinatário pode estar **sem permissão OpenFGA**, com token revogado ou sessão Keycloak inválida. O SQL do P02 **não chama FGA para o destinatário**. O teste real de OpenFGA nesta fase demonstra que ausência de grant nega e que grants não são transferidos entre escopos. **Não é teste ponta a ponta com Keycloak/FGA ligados à API de atribuição**.

## Evidências controladas pelo GitHub Actions

| Ensaio | Como funciona | O que aprova |
|---|---|---|
| `test/pg-assignment-preflight.mjs` | SQL sintético em transação PostgreSQL descartável, `ROLLBACK` garantido | Classificação e não mutação, índice 002, colunas 003 e recibo de backfill |
| `test/fga-assignment-preflight.mjs` | Container `openfga/openfga:v1.22.1` em memória, novo store do modelo versionado, porta `127.0.0.1:18091` | Negativa sem grant, grant explícito, outro tenant/workspace, revogação e indisponibilidade |
| `test/pg-assignment-races.mjs` | PostgreSQL descartável, sessões paralelas, revogação concorrente | Serialização de atribuições, fail-closed e ausência de novo audit na negação |
| `test/pg-org-scope.mjs` | A/B e múltiplos workspaces no banco descartável | Isolamento organizacional no repositório |
| `apps/core-host/test/inbox-pg-http.integration.mjs` | Host NestJS com PostgreSQL real, **verifier e FGA de teste** | Contrato HTTP, grants do ator, negativas 400/403/404; não é login real |

**Execução:** `Syndes Mainline CI → Regression / inbox`, via `modules/inbox/test/postgres-integration.sh`. Não modificar workflows de outros módulos nem usar Desktop Commander enquanto o DevServer01 estiver indisponível. O runner deve destruir exclusivamente os containers identificados com seus labels `syndes.disposable`; sem tokens, volumes ou acesso aos servidores operacionais.

## Relatório histórico e política de saneamento

O diagnóstico gera apenas motivos agregados, não exporta nomes, IDs de pessoas, conversas, telefones nem mensagens:

- `eligible_by_membership`: vínculo P04 ativo de `editor/admin`;
- `missing_scope`: org ou workspace da conversa ausente;
- `organization_inactive` / `workspace_inactive`: domínio operacional inativo;
- `org_membership_inactive` / `workspace_membership_inactive`: membership não encontrada ou revogada;
- `read_only_role`: `viewer` ou papel não elegível.

**Ponto de decisão:** nem todo vínculo histórico inválido deve ser apagado. Uma conversa em resolução, auditoria legal, desligamento de usuário ou transferência em andamento exige política explícita para quem reassume, quem recebe notificação, reversibilidade, trilha e idempotência. Nesta fase nenhum `UPDATE` de reparo é autorizado.

## Gates para implementação operacional posterior

| Gate | Estado no início deste ensaio | Saída exigida |
|---|---|---|
| G1 · SQL/migrations/backfill | Testes sintéticos existentes; ambientes não verificados | Migrations/receipts e restore por Tenant DB, sem bypass de 002 |
| G2 · IAM por destinatário | **LACUNA REAL**; P02 checa membership, não FGA individual | Contrato de recurso/grant aprovado com C04, usuário ativo e negativos Keycloak/OpenFGA |
| G3 · Atribuições legadas | **SEM INVENTÁRIO EM AMBIENTE** | Contagem por categoria em execução autorizada somente leitura, decisão de migração |
| G4 · Regressões SQL/HTTP/concorrência | **APROVADO somente em CI descartável**, run `43968388949` | Reexecutar em alterações de contrato ou código; preservar SHA/logs |
| G5 · Deploy/homologação | **BLOQUEADO enquanto servidor indisponível** | Quando voltar, validar autenticação real, dados A/B, rollback e Product Gate |

A aprovação de G4 **não promove** G1/G2/G3/G5. A implementação completa deve manter a separação de owners: P04 guarda memberships, C04 OpenFGA, C03 identidade e P02 atribuição.

## Como propor a próxima melhoria

Após os testes, a decisão principal é escolher o **contrato de permissão individual do destinatário**. Não criar uma relação OpenFGA improvisada por conversa, nem autorizar `admin/editor` como substituto permanente de acesso efetivo. Definir autorização por recurso e escopo com os owners e integrar o check no fluxo de atribuição com política de revogação e tratamento de indisponibilidade.

## Checkpoint posterior — deploy de desenvolvimento 17/11/2026

A imagem `syndes/core-host:inbox-assign-4126665` foi implantada no DevServer01 depois de canário privado e teste real de contexto/FGA do responsável atual. [Evidências completas](IMPLANTACAO-DEVSERVER01-20261117.md). **O teste sintético P02-ASSIGN-02 continua distinto da verificação real**; IAM individual dos futuros destinatários e aceite do Product Gate não foram implementados.
