"""Source-backed presentation routes for the docs portal; never changes module ownership."""
from pathlib import Path
import html
import json
import re

REPO = "https://github.com/delmacy/syndes-system"

# Display grouping only. One canonical work unit may appear in exactly one group.
# Components with documentationParent stay addressable from their owner, not duplicated.
SYSTEM_AREAS = [
    ("Plataforma Core", ("P14","A04","A08","C01","C02","C06","C07")),
    ("Segurança e acesso", ("C03","C04","C05","A06")),
    ("Canais e comunicações", ("P03","P10")),
    ("Atendimento", ("P02","P05","P07")),
    ("CRM", ("P01",)),
    ("Organizações e usuários", ("P04","P11")),
    ("Automação e IA", ("P08",)),
    ("Documentos e integrações", ("P09",)),
    ("Manager e interfaces", ("A01","A02","A03","A05","A07")),
    ("Faturamento e comercial", ("P12","P13")),
    ("Suporte e operação", ("P06","C08","G05")),
    ("Infraestrutura e ambientes", ("I02","I04","I10","I11")),
    ("Qualidade e observabilidade", ("Q01","Q02","Q03","Q04","Q05","Q06","Q07","Q08","Q09","Q10")),
    ("Arquitetura e governança", ("G01","G02","G03","G04")),
]
AREA_BY_ID = {uid:area for area,ids in SYSTEM_AREAS for uid in ids}
assert sum(len(ids) for _,ids in SYSTEM_AREAS) == len(AREA_BY_ID)

def grouped_navigation(units, display_name):
    visible={u["id"]:u for u in units if not u.get("documentationParent")}
    if set(visible)!=set(AREA_BY_ID):
        raise ValueError(f"Unclassified work units: missing={set(visible)-set(AREA_BY_ID)}, invalid={set(AREA_BY_ID)-set(visible)}")
    result=[]
    for label,ids in SYSTEM_AREAS:
        modules=[]
        for uid in ids:
            unit=visible[uid]
            path=Path(unit["entry"]).parent.relative_to("docs")
            modules.append({f'{uid} · {display_name(unit)}':str(path/"index.md")})
        result.append({label:modules})
    return result

def module_tabs(unit, page):
    """Each tab has its own canonical or build-materialized URL — never hash-only shortcuts."""
    uid=html.escape(unit["id"])
    prefix="" if page=="index.md" else "../"
    tabs=[
        ("Visão geral","index.md"),
        ("Documentação","ESCOPO.md"),
        ("APIs","APIS.md"),
        ("Dados","DADOS.md"),
        ("Contratos","CONTRATOS.md"),
        ("Código","CODIGO.md"),
        ("Dependências","DEPENDENCIAS.md"),
        ("Testes","TESTES.md"),
        ("Projetos (WBS)","EVOLUCAO.md"),
        ("Operação","OPERACAO.md"),
        ("Versões","HISTORICO.md"),
        ("Prompts","PROMPTS.md"),
    ]
    items=[]
    for title,path in tabs:
        href=prefix+("" if path=="index.md" else path.removesuffix(".md")+"/")
        active=(page==path
                or page in ("STATUS.md","SPRINT.md") and path=="OPERACAO.md"
                or page in ("PROJECAO.md","IMPLEMENTACAO.md","ALTERACAO.md") and path=="PROMPTS.md")
        items.append(f'<a href="{html.escape(href,quote=True)}"'+
                     (' aria-current="page"' if active else '')+
                     f'>{html.escape(title)}</a>')
    label=html.escape(AREA_BY_ID[unit["id"]])
    source=html.escape(unit["source"])
    return (f'<div class="syndes-module-eyebrow">Módulos / {label} / {uid} · Fonte: <code>{source}</code></div>\n'
            f'<nav class="syndes-module-tabs" aria-label="Assuntos do módulo">{"".join(items)}</nav>')

def scoped_prompts_page(unit, name):
    uid=unit["id"]
    source=unit["source"]
    folder=Path(unit["entry"]).parent
    # Only the documents approved in the canonical catalog are used; no new implementation instructions.
    lines=[
        f"# {uid} — {name} | Prompts do agente",
        "",
        "> **Instruções de escopo, não sandbox de segurança.** Prompts orientam o agente; limites reais de escrita exigem permissões e validação de diff no Git. Nenhuma Issue ou proposta autoriza implementação por si só.",
        "",
        "## Fronteiras da unidade {#fronteiras-do-agente}",
        "",
        f"- **ID responsável:** `{uid}` — {name}.",
        f"- **Artefato próprio do catálogo:** `{source}`.",
        f"- **Documentos sob sua responsabilidade:** `{folder.as_posix()}/`.",
        "- **Leitura externa permitida:** `AGENTS.md`, contratos públicos e documentação estritamente necessários para a interface consumida.",
        "- **Edição proibida sem decisão separada:** internos de outros módulos, monorepo compartilhado, CI/CD, infraestrutura global, schemas externos, serviços de identidade, secrets, deploy e qualquer recurso de tenant real.",
        "- **Quando houver dependência externa:** registrar o módulo proprietário, o contrato, o bloqueio e uma solicitação específica. Não contornar a fronteira por import privado.",
        "",
        "## Modos de trabalho {#modos}",
        "",
        "| Modo | Arquivo fonte versionado | Autorização |",
        "|---|---|---|",
        "| Projeção e requisitos | [Abrir prompt de projeção](PROJECAO.md) | Análise, sem modificar código |",
        "| Implementação | [Abrir prompt de implementação](IMPLEMENTACAO.md) | Somente incremento aprovado e dentro do owner |",
        "| Correção pontual | [Abrir prompt de alteração](ALTERACAO.md) | Bug/ajuste permitido, com testes e evidências |",
        "",
        "## Pré-condições para execução {#precondicoes}",
        "",
        "1. Conferir SHA, branch/worktree e mudanças de terceiros antes de qualquer escrita.",
        "2. Ler `AGENTS.md`, a regra local do módulo quando existir, `STATUS.md`, `SPRINT.md` e o incremento autorizado.",
        "3. Identificar caminhos **permitidos**, arquivos afetados, teste unitário/contrato necessário e possíveis consumidores.",
        f"4. Conferir o diff com `python3 scripts/docs/verify_module_scope.py --module {uid} --base origin/main`. Arquivos fora da fronteira ou com ownership compartilhado devem ser tratados como bloqueio.",
        "5. Se o pedido não for aprovado, preparar proposta contextual pela ação **Editar/Acrescentar** do tópico; não executar código.",
        "6. Ao finalizar, registrar a evidência no STATUS e no incremento, sem declarar aceite ou deploy não comprovado.",
        "",
        "## Atalhos {#atalhos}",
        "",
        f"[Escopo](ESCOPO.md) · [Referência de contratos](REFERENCIA-TECNICA.md) · [Projetos/WBS](EVOLUCAO.md) · [Status](STATUS.md) · [Sprint](SPRINT.md) · [Histórico](HISTORICO.md)",
        "",
        "Os prompts completos são copiados de suas páginas canônicas usando o botão **Copiar prompt completo desta página**. Isso preserva uma única fonte editável por tipo de tarefa."
    ]
    return "\n".join(lines)+"\n"

def project_registry(units, associations, display_name, revision, site_base):
    if associations.get("schemaVersion")!=1 or associations.get("mappingType")!="association-not-assignment":
        raise ValueError("Unknown WBS association format")
    visible=[u for u in units if not u.get("documentationParent")]
    data=[]
    for u in visible:
        uid=u["id"]
        a=associations["units"].get(uid,{"taskIds":[],"relatedPlans":[]})
        tasks=a.get("taskIds",[])
        if not isinstance(tasks,list) or any(not re.fullmatch(r"\d{2}\.\d{2}",v) for v in tasks):
            raise ValueError("Invalid task IDs: "+uid)
        path=Path(u["entry"]).parent.relative_to("docs").as_posix()
        data.append({"id":uid,"name":display_name(u),"area":AREA_BY_ID[uid],
                     "taskIds":tasks,"workpackageIds":sorted({v.split(".")[0] for v in tasks}),
                     "relatedPlans":[{"path":v,"url":REPO+"/blob/main/"+v}
                        for v in a.get("relatedPlans",[])],
                     "links":{"module":site_base+path+"/",
                              "wbs":site_base+path+"/EVOLUCAO/",
                              "status":site_base+path+"/STATUS/",
                              "sprint":site_base+path+"/SPRINT/",
                              "history":site_base+path+"/HISTORICO/",
                              "issues":REPO+"/issues?q=is%3Aissue%20"+uid}})
    if len(data)!=len(visible):
        raise ValueError("Project registry mismatch")
    return {"revision":revision,"source":associations["source"],
            "state":"planning-associations-only","units":data}
