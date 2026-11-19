# Contrato de execução para agente — programa MO-REL

**Leia primeiro:** [WBS-MULTIORG-PRODUCTION-READINESS-20261119.md](./WBS-MULTIORG-PRODUCTION-READINESS-20261119.md). O prompt que inicia o agente **NÃO contém os requisitos técnicos**: deve obtê-los do repositório, sempre na HEAD atual, e respeitar este runbook.

## Bootstrap obrigatório, antes de qualquer modificação

1. Conectar-se ao repositório `delmacy/syndes-system`; consultar `main` e seu SHA real. `git fetch origin main`, `git status --porcelain` e `git log -1 --format='%H %s' origin/main` se houver shell Git. Se estiver operando pela integração GitHub, equivalentes via API. **Não inferir main a partir da conversa.**
2. Ler `AGENTS.md` na raiz e os AGENTS dos diretórios que serão tocados; ler WBS MO-REL, `MULTIORG-RELEASE-SECURITY-GATES-20261118.md`, `ADR-IAM-IDENTITY-AUTHORITY-MULTIORG-20261118.md`, WBS IAM e PRD/UC signup. Ler código e testes relacionados à etapa, sem se apoiar somente nos documentos.
3. Consultar o GitHub **ao vivo**: issues [#193](https://github.com/delmacy/syndes-system/issues/193), [#160](https://github.com/delmacy/syndes-system/issues/160), [#189](https://github.com/delmacy/syndes-system/issues/189), PRs abertos recentes e os jobs reais do `Syndes Mainline CI`. Observar especialmente #200 e a HEAD atual; estado conhecido no baseline pode ter mudado.
4. Selecionar **o menor ID MO-REL-xx cujo aceite ainda não esteja comprovado**, respeitando dependências e escopo do agente. Se issue contém status desatualizado, atualizar com evidências antes de selecionar. Não pedir nova ordem se ela já consta da WBS.
5. Fazer um pequeno plano: arquivos proprietários e contratos existentes, risco de cross-tenant/org/ws, testes positivos/negativos, rollout/rollback, critério de aceite, SHA de partida e o que permanece expressamente fora de escopo. Publicar em issue/PR.

## Protocolo de desenvolvimento

- Implementar **uma etapa por vez**, em branch/PR curto da `main` atual; reposicionar/reconciliar mudanças se main avançar. Acelerador permitido: merges após gate CI completo; **nunca** enfraquecer checks nem deixar `main` atrás de branches com mudanças finalizadas.
- Preferir corrigir contratos e componentes existentes; `catalog/work-units.json` define owner. Não criar novo módulo, frontend, outbox ou framework se já existir dono.
- Código-fonte: preservar `OpenFGA` como autoridade de grant fino, `Keycloak` como IdP, `Control` para entitlement e vínculo, tenant SQL para dados/epoch/fence, e Core para admissão; `actor.id` não implica acesso a todas as Organizations. `Manager` isolado, sem privilégio implícito em conteúdo de clientes.
- Testes unitários **e** testes de integração reais onde houver segurança (Keycloak real descartável, OpenFGA real, PG17 real, Nest real, workers de verdade) para demonstrar deny A/B, revogação e rollback. Para migrações: replay, ausência de grant automático, FKs de ownership e banco descartável.
- Usar **apenas GitHub Actions** para deploy/provisionamento de servidores; nada de iniciar container, executar SQL operacional ou instalar migration diretamente via SSH/Desktop Commander. Mesmo com autorização de desenvolvimento, **não** executar cutover SQL002 em produção sem decisão operacional explícita de GO.
- Não alterar proteções de `main`, desligar checks, alterar workflows fora da etapa CI/deploy delegada, limpar logs/DB reais, copiar secrets para commits ou promover `SYNDES_MULTI_ORG_ENABLED=true` sem aceite G-1..G-6.
- Distinguir `IMPLEMENTED`, `INTEGRATED`, `TESTED`, `PROVEN`, `DEPLOYED` e `RELEASED` por evidência. Logs com segredo, JWT, principal ou PII não entram em PR/issue.
- Não tentar criar tenant/Organization com SQL sem Keycloak/Control e FGA consistente; sagas não fazem transação distribuída mágica. Retentativa `ready` nunca regranta membership humana revogada.
- Ao identificar bloqueio que depende de credencial, aprovação ou infraestrutura não conectada, registrar `BLOCKED` com **a configuração/ACL exata que falta, comando de verificação read-only e o efeito em produto**. Avançar apenas com tarefas comprováveis de segurança; não inventar status `READY`.

## Sequência por etapa e Definition of Done

```
FETCH main -> READ AGENTS/WBS/issues -> RECONCILE status
  -> SELECT first unproven MO-REL-xx -> READ exact owner/source/contracts
  -> IMPLEMENT smallest safe slice
  -> UNIT + NEGATIVE + REAL INTEGRATION / PG17 disposable
  -> PR + central CI (head SHA)
  -> FIX failures without weakening tests
  -> MERGE only if Syndes CI Gate SUCCESS
  -> DOCUMENT evidence/remaining blockers
  -> NEXT eligible MO-REL-xx (if safe)
```

Para cada etapa, entregar comentário no issue com:
- `MO-REL-xx`, título e dependências satisfatórias;
- branch/PR, commit em `main`, link do workflow **do SHA aprovado** e jobs/markers;
- contratos/migrations/rotas realmente alterados, matriz deny/allow e riscos;
- rollback e validação de comportamento antigo;
- novo status `TODO/IN_PROGRESS/PROVEN/BLOCKED` com justificativa;
- próximos gates e **`PRODUCTION_GATE` factual**.

Se todos os critérios da etapa estiverem comprovados, fechar a issue filha correspondente. Manter issue-mãe #193 aberta até MO-REL-08 e evidências de piloto. `MO-REL-07` não implica liberação de produção; `MO-REL-08` exige aprovação explícita do responsável do release.

## Modos e hierarquia de fontes

- **Referência de release:** `docs/engineering/WBS-MULTIORG-PRODUCTION-READINESS-20261119.md`.
- **Critérios de segurança:** `docs/engineering/MULTIORG-RELEASE-SECURITY-GATES-20261118.md` + código/CI vigentes.
- **Contrato de signup:** `docs/product/UC-SIGNUP-TENANT-ORGANIZATION-WORKSPACE-WIZARD-20261118.md` + issue #189.
- **Histórico IAM:** `docs/engineering/WBS-KEYCLOAK-ORGANIZATIONS-CAPABILITIES-20261117.md` + issue #160.
- **Arquitetura:** `docs/engineering/ADR-IAM-IDENTITY-AUTHORITY-MULTIORG-20261118.md` e AGENTS locais.
- **Rastreamento:** issue-mãe #193, issues filhas MO-REL-xx e PRs. Em caso de conflito, conferir código no HEAD e o teste com evidência; abrir correção documental.

## Política de conclusão

A resposta final de cada sessão deve dizer com precisão o que foi integrado e testado e o que não foi. **Não declarar multi-org pronto por CI verde de componentes**. A liberação depende de execução de staging, restore e autorização do piloto real. O objetivo é entregar o produto funcional, não apenas passar no build.
