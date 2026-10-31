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
esse worker**: se nasceu com modelo pinado, quanto durou, se foi liberado ou
ficou vazando.

A evidência de frota vem como **commit status** `orca-fleet/audit`, publicado
pelo host que tem a frota (o Orca local, via `orca-fleet-audit.ps1 -PostStatus`),
não por arquivo dentro do commit.

### Por que status e não arquivo

Um arquivo `.audit/fleet/<sha>.json` dentro do commit precisaria conter o SHA do
próprio commit que o contém — impossível. Commitar em um commit seguinte desloca
a evidência para fora do objeto auditado. O status resolve porque é publicado
**depois** que o SHA existe e fica vinculado a ele pela própria API.

Checks API não é usada: exige autenticação de GitHub App. O token disponível é
OAuth, que cria status mas não check runs (`403: You must authenticate via a
GitHub App`).

### Formato

Descrição limitada a 140 caracteres, formato estável e parseável:

```
w10 rel5 leak0 pin0/10 churn306 sha:86b79918
```

| Campo | Significado |
| --- | --- |
| `w` | workers criados |
| `rel` | liberados |
| `leak` | retidos acionáveis (vazamento) |
| `pin` | com modelo pinado / total |
| `churn` | `consumer_generation` do run — proxy de recriação do coordenador |
| `sha:` | prefixo do digest do registro completo, para casar com o ledger local |

O JSON completo fica no ledger append-only do host (`~/.orca-fleet/ledger.jsonl`),
endereçado por esse prefixo de digest.

### Efeito no veredito

O status de frota **não** altera o `verdict` do manifesto: reprovar CI por
vazamento de terminal misturaria duas coisas diferentes. Ele entra como dado e
como aviso — `fleet-status:failure` quando há vazamento, `fleet-status:unparsable`
quando a descrição não segue o formato.

Ausência é registrada como `orchestration.present = false`, e o comentário diz
"sem registro".


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
