#!/usr/bin/env python3
"""One-time, source-linked module evolution index from the existing Syndes WBS.

This creates EVOLUCAO.md only when missing. It NEVER overwrites a module plan;
after creation that Markdown is an agent-editable document in Git.
"""
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT=Path(__file__).resolve().parents[2]
CATALOG=json.loads((ROOT/"catalog/work-units.json").read_text(encoding="utf8"))
UNITS=json.loads((ROOT/"docs/subprojects/index.json").read_text(encoding="utf8"))["units"]
ASSOCIATIONS=json.loads((ROOT/"catalog/evolution-associations.json").read_text(encoding="utf8"))
WBS=ROOT/ASSOCIATIONS["source"]
SOURCE_LINK=ASSOCIATIONS["source"]

def normalize_cell(s):
    return s.strip().replace("\\|","|")

def parse_master_wbs(path):
    """Read task IDs and workpackage metadata, without inventing statuses."""
    packages={}
    tasks={}
    current=None
    for line in path.read_text(encoding="utf8").splitlines():
        m=re.match(r"^### WBS (\d{2}) — (.*)$",line)
        if m:
            current=m.group(1)
            packages[current]={"id":current,"title":m.group(2),"priority":"A CONFERIR NA WBS","gate":"A CONFERIR NA WBS","tasks":[]}
            continue
        if current is None:continue
        if line.startswith("### "):current=None;continue
        if line.startswith("**Prioridade:**"):
            packages[current]["priority"]=line.split("**Prioridade:**",1)[1].split("·")[0].strip().replace("**","")
            if "**Gate:**" in line:
                packages[current]["gate"]=line.split("**Gate:**",1)[1].split(";",1)[0].strip()
            elif "**Gate " in line:
                parts=line.split("**Gate ",1)[1].split(":**",1)
                if len(parts)==2:
                    packages[current]["gate"]=parts[0]+": "+parts[1].split(";",1)[0].strip()
        m=re.match(r"^\|\s*\*\*(\d{2}\.\d{2})(?:\s*/\s*([^*]+))?\*\*\s*\|",line)
        if not m:continue
        task_id=m.group(1)
        if task_id in tasks:raise ValueError("Duplicated WBS task "+task_id)
        cells=[normalize_cell(x) for x in re.split(r"(?<!\\)\|",line.strip().strip("|"))]
        if len(cells)<4:raise ValueError("Bad source WBS row "+task_id)
        if len(cells)>=5:
            objective,acceptance,depends,state=cells[1:5]
        else:
            objective,depends,state=cells[1:4];acceptance="Ver conteúdo de entrega e aceite na WBS."
        record={"id":task_id,"aliases":m.group(2) or "", "package":current,
                "objective":objective,"acceptance":acceptance,
                "depends":depends,"state":state}
        tasks[task_id]=record
        packages[current]["tasks"].append(task_id)
    if len(tasks)<90:raise ValueError("Unexpectedly small master WBS parse: "+str(len(tasks)))
    return packages,tasks

def safe(s):
    return str(s).replace("|",r"\|").replace("\n"," ").strip()

def make_page(unit,entry,packages,tasks):
    uid=unit["id"]; name=unit["name"]
    base=Path(unit["scope"]).parent.as_posix()
    ids=entry["taskIds"]
    grouped=defaultdict(list)
    for tid in ids:
        if tid not in tasks:raise ValueError("Unknown master WBS task "+tid+" for "+uid)
        grouped[tasks[tid]["package"]].append(tasks[tid])
    lines=[
      f"# {uid} — {name} | Evolução",
      "",
      "> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.",
      "",
      "## Painel do módulo",
      "",
      "| Indicador | Fonte e interpretação |",
      "|---|---|",
      f"| Unidade | `{uid}` — `catalog/work-units.json` |",
      f"| Workpackages relacionados | {len(grouped)} grupos da WBS mestre (revisão histórica) |",
      f"| Tarefas com referência | {len(ids)} IDs rastreáveis, sem duplicar os requisitos |",
      f"| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |",
      f"| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |",
      f"| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |",
      f"| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[{uid}]` |",
      "",
      "## Workpackages e tarefas existentes",
      "",
      f"**Origem rastreável:** [WBS mestre do Syndes](../../engineering/{WBS.name}) · caminho exato `{SOURCE_LINK}`.",
      "",
      "Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.",
      ""
    ]
    if not grouped:
        lines+=["Nenhum workpackage foi associado diretamente nesta versão do inventário. Isso **não significa ausência de tarefas**. Reconciliar escopo e WBS especializada antes de criar novos IDs.",""]
    for group_id in sorted(grouped):
        group=packages[group_id]
        lines.extend([f"### WP-{group_id} — {group['title']}","",
          f"**Prioridade na fonte:** {safe(group['priority'])} · **Gate:** {safe(group['gate'])}",
          "",
          "| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |",
          "|---|---|---|---|"])
        for task in sorted(grouped[group_id],key=lambda x:x["id"]):
            ident=task["id"];aliases=f" ({safe(task['aliases'])})" if task["aliases"] else ""
            lines.append(f"| [**{ident}**](../../engineering/{WBS.name}){aliases} | {safe(task['objective'])} | {safe(task['depends'])} | {safe(task['state'])} |")
        lines+=["",f"**Critérios de aceite e evidências originais:** consultar a seção **WBS {group_id}** em `{SOURCE_LINK}`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.",""]
    if entry["relatedPlans"]:
        lines+=["## Planos especializados e dependências documentais","",
                "Esses documentos contêm o detalhamento das frentes relacionadas, mas **não são automaticamente metas da sprint**.",""]
        for path in entry["relatedPlans"]:
            ref=Path(path)
            if not (ROOT/path).is_file():raise FileNotFoundError(path)
            lines.append(f"- [{ref.stem.replace('-', ' ')}](../../engineering/{ref.name}) — `{path}`")
        lines.append("")
    lines += [
      "## Backlog local e novos workpackages",
      "",
      "Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.",
      "",
      "| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |",
      "|---|---|---|---|---|---|",
      "| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |",
      "",
      f"Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `{uid}-WP-01` e `{uid}-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `{uid}`.",
      "",
      "## Próximo incremento e checkpoint",
      "",
      "1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).",
      "2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.",
      "3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.",
      "",
      "**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.",
      ""
    ]
    return "\n".join(lines)

def main():
    packages,tasks=parse_master_wbs(WBS)
    ids={u["id"] for u in UNITS}
    if len(UNITS)!=57 or set(ASSOCIATIONS["units"])!=ids:
        raise ValueError("Incomplete or stale evolution inventory")
    made=0;rows=0
    for unit in UNITS:
        entry=ASSOCIATIONS["units"][unit["id"]]
        target=ROOT/Path(unit["scope"]).parent/"EVOLUCAO.md"
        if target.exists():continue
        target.write_text(make_page(unit,entry,packages,tasks),encoding="utf8")
        readme=target.parent/"README.md"
        text=readme.read_text(encoding="utf8")
        if "EVOLUCAO.md" not in text:
            readme.write_text(text.rstrip()+"\n9. **Evolução planejada:** [Workpackages e tasks](EVOLUCAO.md).\n",encoding="utf8")
        made+=1;rows+=len(entry["taskIds"])
    print("Created",made,"module evolution pages from",len(packages),"WBS workpackages;",len(tasks),
          "canonical tasks;",rows,"cross-module associations. Existing pages untouched.")

if __name__=="__main__":main()
