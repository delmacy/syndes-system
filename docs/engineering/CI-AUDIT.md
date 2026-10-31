# CI Audit

Registro auditável do trabalho de agentes (codex/Orca) que chega ao repositório.

## Por quê

CI comum prova que **um SHA passou**. Não prova **de onde aquele SHA veio**. Sem
essa ligação, um run verde não diz qual agente, em qual worktree, produziu o
commit — e "auditoria" passa a ser uma afirmação sem evidência.

Este repositório fecha a lacuna em duas metades:

1. **Atribuição** — o commit carrega trailers que identificam o agente, a
   worktree e a sessão que o produziu.
2. **Reconciliação** — o workflow `Agent CI Audit` verifica esses trailers,
   executa os gates e publica um manifesto com SHAs, conclusões e digest.

## Trailers de procedência

Todo commit produzido por agente deve terminar com:

```
Orca-Worktree: <repoId>::<worktreePath>
Orca-Agent: codex
Orca-Session: <handle da sessão>
Base-SHA: <sha da base em que o agente trabalhou>
```

`Base-SHA` é opcional e serve para detectar trabalho feito sobre uma base
desatualizada. Assinatura canônica:

```
feat(core-crm): add tenant-scoped person repository

Orca-Worktree: 1085c6a7-ca3e-44bf-9dcf-18304a300a64::C:\Users\admin\orca\syndes-system
Orca-Agent: codex
Orca-Session: term-14f9c2
Base-SHA: 9b1f0aa
```

## Veredito

O status `agent-ci/audit` é o único check que sintetiza o run:

| Condição | Veredito | Commit status |
| --- | --- | --- |
| Todos os gates `success` | `pass` | `success` |
| Qualquer gate não `success` | `fail` | `failure` |
| Trailers ausentes, `REQUIRE_TRAILERS=false` | `pass` + aviso no manifesto | `success` |
| Trailers ausentes, `REQUIRE_TRAILERS=true` | `fail` | `failure` |

A adoção é gradual por decisão explícita: `REQUIRE_TRAILERS` começa em `"false"`
para não reprovar branches já em andamento. Quando as branches ativas passarem a
carregar os trailers, a variável vira `"true"` e o gate passa a ser bloqueante.

## Evidência publicada

Cada run deixa três artefatos, todos verificáveis independentemente:

- **`audit-manifest.json`** — schema `syndes.ci-audit/1`: repositório, run,
  trigger, commit (head/base/lowest), atribuição do agente, lista de gates com
  conclusão e duração, `verdict` e `warnings`.
- **`audit-manifest.sha256`** — digest do manifesto acima; é o valor citado no
  comentário do PR e na descrição do status.
- **`provenance.json`** — matéria-prima da atribuição, incluindo quantos commits
  no intervalo carregam trailers completos.

O artifact fica retido por 90 dias. Como artefatos de Actions não podem ser
alterados depois de publicado, o digest publicado no PR ancora o conteúdo: se
alguém adulterar um manifesto, o sha256 deixa de bater.

## Tratamento da frota Orca

Os trailers provam **quem** produziu o commit. Não provam **como o Orca tratou
esse worker** — se nasceu com modelo pinado, quanto durou, se foi liberado ou
ficou vazando.

Quando o commit traz `.audit/fleet/<head_sha>.json` (schema
`syndes.fleet-audit/1`, gerado por `orca-fleet-audit.ps1`), o manifesto incorpora
um bloco `orchestration` com:

| Campo | Significado |
| --- | --- |
| `workers` / `settled` | quantos nasceram e quantos entregaram |
| `released` / `retained_actionable` | quantos foram liberados; quantos ficaram vazando |
| `external_residue` | terminais que o Orca nunca possuiu (resíduo inerte) |
| `model_pinned` / `model_unpinned` | se o worker foi pinado num modelo ou caiu no default |
| `coordinator_churn` | `consumer_generation` do run — proxy de recriação do coordenador |
| `ledger_digest` | sha256 da linha correspondente no ledger local |

### O que é validado

- schema igual a `syndes.fleet-audit/1`
- `scope.commit_sha` **igual** ao head do run — impede reaproveitar o registro de
  outro commit
- `evidence.sha256` com formato válido (64 hex)

O digest **não** é recriptografado aqui, e é deliberado: o arquivo está dentro do
próprio commit, então o git é a camada de integridade. Recalcular o hash só
provaria que o arquivo concorda consigo mesmo.

Registro ausente não reprova: vira `orchestration.present = false` e o comentário
diz "sem registro". Vazamento real (`retained_actionable > 0`) gera aviso
`fleet-leak:N` no manifesto.


## Decisão sobre qual SHA é testado

Os gates rodam sobre o **SHA de topo do PR**, não sobre o merge commit. O objeto
da auditoria é o commit que o agente produziu; validar o resultado do merge é
responsabilidade dos workflows de integridade e merge-candidate.

## Gates

Os gates são scripts em `tests/`, nunca lógica embutida em YAML — o workflow é
apenas um executor. Hoje:

| Gate | Fonte única |
| --- | --- |
| Repository structure | `tests/integrity/repository-structure.sh` |
| Module agent contracts | `tests/integrity/module-contracts.sh` |

Para adicionar um gate: crie o script em `tests/`, adicione um job que o invoque,
e inclua-o na matriz `GATES` do job `audit`. Não replique a lógica no YAML.
