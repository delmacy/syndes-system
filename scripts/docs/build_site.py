#!/usr/bin/env python3
"""Build a selected Markdown book; never publish arbitrary repo docs/configuration."""
from pathlib import Path
import json, re, shutil, yaml
import subprocess
import html
from datetime import datetime, timezone
from portal_views import grouped_navigation, module_tabs, scoped_prompts_page, project_registry

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
OUT = ROOT / ".docs-site"
CONTENT = OUT / "content"
REPO = "https://github.com/delmacy/syndes-system"
FRONTS = [(x["id"],x["name"]) for x in json.loads((ROOT/"catalog/work-units.json").read_text())["fronts"]]

def display_name(unit):
    """Presentation title from the tracked unit homepage; canonical catalog name stays untouched."""
    first=(ROOT/unit["entry"]).read_text(encoding="utf-8").splitlines()[0]
    match=re.fullmatch(r"#\s+"+re.escape(unit["id"])+r"\s+[—–-]\s+(.+)",first.strip())
    return match.group(1).strip() if match else unit["name"]

def site_rel(path):
    rel = path.relative_to(DOCS)
    return rel.with_name("index.md") if rel.name == "README.md" else rel

def rewrite_links(text, source, included):
    def replace(m):
        label, url = m.groups()
        if url.startswith(("http:", "https:", "#", "mailto:", "tel:")):
            return m.group()
        name, marker, anchor = url.partition("#")
        dest = (source.parent/name).resolve()
        if not dest.exists():
            return m.group()
        if dest in included:
            return "["+label+"]("+url.replace("README.md","index.md")+ ")" if dest.name == "README.md" else m.group()
        if dest.is_relative_to(ROOT):
            return "["+label+"]("+REPO+"/blob/main/"+dest.relative_to(ROOT).as_posix()+marker+anchor+")"
        return m.group()
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",replace,text)

def markdown_sections(raw):
    """Return heading-scoped Markdown without mistaking fenced code headings for sections."""
    lines=raw.splitlines(keepends=True)
    positions=[]; fence=None
    for i, line in enumerate(lines):
        stripped=line.lstrip()
        marker=re.match(r"^(`{3,}|~{3,})",stripped)
        if marker:
            token=marker.group(1)
            if fence is None:
                fence=token
            elif token[0]==fence[0] and len(token)>=len(fence):
                fence=None
            continue
        if fence: continue
        m=re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$",line)
        if m:
            heading=m.group(2).strip()
            positions.append((i,len(m.group(1)),heading))
    result=[]
    for index,(line_number,level,title) in enumerate(positions):
        if level==1 and any(next_level>1 for _,next_level,_ in positions):
            continue
        end=next((pos for pos,next_level,_ in positions[index+1:] if next_level<=level),len(lines))
        value="".join(lines[line_number:end]).rstrip()+"\n"
        result.append({"position":line_number+1,"endLine":end,"level":level,"heading":title,"markdown":value})
    return result

def blame_revisions(path):
    """Blame each line once. Complete history is required for accurate per-topic dates."""
    try:
        raw=subprocess.check_output(
            ["git","blame","--line-porcelain","--",path.relative_to(ROOT).as_posix()],
            cwd=ROOT,text=True,stderr=subprocess.DEVNULL,timeout=30)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError):
        return []
    lines=[]; commit=None; time_value=None
    for row in raw.splitlines():
        match=re.match(r"^([0-9a-f]{40}) \d+ \d+(?: \d+)?$",row)
        if match:
            commit=match.group(1)
            time_value=None
        elif row.startswith("committer-time "):
            try: time_value=int(row.partition(" ")[2])
            except ValueError: time_value=None
        elif row.startswith("\t"):
            lines.append((time_value,commit))
    return lines

def annotate_revisions(sections, raw, revisions):
    """A parent heading includes its nested content; a child tracks its own range."""
    for section in sections:
        start=section["position"]-1
        end=section["endLine"]
        blocks=[(epoch,sha) for epoch,sha in revisions[start:end]
                if epoch and sha and sha!="0"*40]
        if blocks:
            epoch,sha=max(blocks,key=lambda pair:pair[0])
            section["lastModified"]=datetime.fromtimestamp(epoch,timezone.utc).isoformat()
            section["lastCommit"]=sha
        else:
            section["lastModified"]=None
            section["lastCommit"]=None
        section.pop("endLine",None)
    return sections

def navigation_tree(units, canonical):
    """Compact two-level discovery: area > module home. Six detailed pages stay linked from each home."""
    if len(units) != len(canonical):
        raise ValueError("Catalog size mismatch")
    canonical_by_id={u["id"]:u for u in canonical}
    ids=set()
    nav=[]
    areas=[(front_id,label,"all") for front_id,label in FRONTS if front_id!="qualidade"]
    areas.extend([("qualidade","Infraestrutura e hospedagem","I"),
                  ("qualidade","Qualidade e testes","Q")])
    for front_id,front_label,kind in areas:
        modules=[]
        for unit in units:
            if unit["front"]!=front_id: continue
            if kind=="I" and not unit["id"].startswith("I"): continue
            if kind=="Q" and unit["id"].startswith("I"): continue
            uid=unit["id"]
            if uid in ids or uid not in canonical_by_id or canonical_by_id[uid]["front"]!=front_id:
                raise ValueError("Invalid owner or duplicate unit "+uid)
            ids.add(uid)
            parent_id=unit.get("documentationParent")
            if parent_id is not None:
                parent=canonical_by_id.get(parent_id)
                catalog_unit=canonical_by_id[uid]
                child_source=Path(unit["source"])
                relation=unit.get("documentationRelation")
                if relation != catalog_unit.get("documentationRelation"):
                    raise ValueError("Documentation relationship mismatch for "+uid)
                contained=(bool(parent) and child_source.is_relative_to(Path(parent["path"]))
                           and child_source!=Path(parent["path"]))
                hosting=(bool(parent) and relation=="infrastructure-hosting" and parent_id=="I02"
                         and uid.startswith("I") and parent["front"]==unit["front"]
                         and (ROOT/child_source).exists())
                if (not parent or uid==parent_id
                        or catalog_unit.get("documentationParent")!=parent_id
                        or parent.get("documentationParent")
                        or not (contained or hosting)):
                    raise ValueError("Invalid documentation component/parent for "+uid)
                # Work-unit remains addressable by ID, but is not a top-level product module.
                continue
            if canonical_by_id[uid].get("documentationParent"):
                raise ValueError("Documentation hierarchy mismatch for "+uid)
            d=Path(unit["entry"]).parent.relative_to("docs")
            modules.append({uid+" · "+display_name(unit):str(d/"index.md")})
        nav.append({front_label:modules})
    if ids!=set(canonical_by_id):
        raise ValueError("Missing or duplicate units in compact navigation")
    return nav


def chapter_markdown_at_scope(source, scope, included):
    """Resolve chapter links relative to the rendered scope page, not its source folder."""
    import os
    raw=source.read_text(encoding="utf-8")
    def replace(match):
        label,url=match.groups()
        if url.startswith(("http:","https:","mailto:","tel:","#","/")):
            return match.group(0)
        path,separator,anchor=url.partition("#")
        target=(source.parent/path).resolve()
        if not target.exists():
            return match.group(0)
        if target in included:
            relative=os.path.relpath(target,scope.parent).replace(os.sep,"/")
            return f"[{label}]({relative}{separator}{anchor})"
        if target.is_relative_to(ROOT):
            return f"[{label}]({REPO}/blob/main/{target.relative_to(ROOT).as_posix()}{separator}{anchor})"
        return match.group(0)
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",replace,raw)


def embed_chapters_in_scopes(units, revision, included):
    """Compose a reader-friendly scope view while preserving exact Markdown source per section."""
    for unit in units:
        scope=(ROOT/unit["scope"]).resolve()
        chapters=sorted((scope.parent/"chapters").rglob("*.md"))
        if not chapters:
            continue
        target=CONTENT/site_rel(scope)
        page=target.read_text(encoding="utf-8")
        metadata_path=target.with_suffix(".sections.json")
        metadata=json.loads(metadata_path.read_text(encoding="utf-8"))
        appendix=["\n\n---\n\n## Conteúdo da especificação\n",
                  "Os assuntos abaixo são exibidos juntos para leitura. Cada capítulo continua em seu Markdown próprio para edição e agentes.\n"]
        for chapter in chapters:
            source_ref=chapter.relative_to(ROOT).as_posix()
            edit_url=f"{REPO}/edit/main/{source_ref}"
            appendix.append(f'\n<div class="syndes-chapter-source"><a href="{edit_url}">Editar capítulo no GitHub</a> · <code>{source_ref}</code></div>\n')
            appendix.append(chapter_markdown_at_scope(chapter,scope,included))
            appendix.append("\n\n")
            chapter_data=json.loads((CONTENT/site_rel(chapter)).with_suffix(".sections.json").read_text(encoding="utf-8"))
            for section in chapter_data["sections"]:
                section["source"]=source_ref
                metadata["sections"].append(section)
        target.write_text(page+"\n".join(appendix),encoding="utf-8")
        metadata_path.write_text(json.dumps(metadata,ensure_ascii=False),encoding="utf-8")

def tracked_commits(path, limit=6):
    """Git is authoritative for changed files; its log is not product acceptance."""
    try:
        relative=path.relative_to(ROOT).as_posix()
        if not path.exists():
            return []
        raw=subprocess.check_output(
            ["git","log","--no-merges",f"--max-count={limit}",
             "--format=%H%x1f%cI%x1f%s%x1e","--",relative],
            cwd=ROOT,text=True,stderr=subprocess.DEVNULL,timeout=15)
    except (ValueError,OSError,subprocess.CalledProcessError,subprocess.TimeoutExpired):
        return []
    result=[]
    for item in raw.split("\x1e"):
        fields=item.strip().split("\x1f",2)
        if len(fields)==3 and re.fullmatch(r"[0-9a-f]{40}",fields[0]):
            sha,stamp,subject=fields
            result.append({"sha":sha,"date":stamp[:10],"subject":subject.strip()[:135]})
    return result

def safe_markdown_cell(value):
    return html.escape(str(value),quote=False).replace("|",r"\|").replace("[",r"\[").replace("]",r"\]")

def read_traceability(units):
    """Validate links; never infer a task's status or manufacture commit IDs."""
    path=ROOT/"catalog/traceability-links.json"
    data=json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion")!=1:
        raise ValueError("Unknown traceability format")
    known={u["id"]:u for u in units}
    seen=set()
    grouped={uid:[] for uid in known}
    for record in data.get("records",[]):
        rid=record["id"]
        uid=record["moduleId"]
        if uid not in known or rid in seen:
            raise ValueError("Invalid or duplicate trace record "+str(rid))
        seen.add(rid)
        for key in ("workpackage","workItem"):
            obj=record[key]
            doc=ROOT/obj["document"]
            if not doc.is_file() or not doc.is_relative_to(DOCS):
                raise ValueError("Invalid trace document "+str(doc))
            text=doc.read_text(encoding="utf-8")
            if obj["id"] not in text:
                raise ValueError("Trace ID not in linked document: "+obj["id"])
        if record.get("requirement"):
            doc=ROOT/record["requirement"]["document"]
            if not doc.is_file(): raise ValueError("Missing requirement: "+str(doc))
        if record.get("commit") and not re.fullmatch(r"[0-9a-f]{40}",record["commit"]):
            raise ValueError("Invalid trace commit "+rid)
        for key in ("issue","pullRequest","testEvidence","deployment","acceptance"):
            value=record.get(key)
            if value is not None and not (isinstance(value,str) and value.startswith("https://")):
                raise ValueError("Trace evidence must be an HTTPS URL or null: "+rid+"/"+key)
        grouped[uid].append(record)
    return grouped

def history_table(path,label):
    entries=tracked_commits(path,6)
    lines=["### "+label+"\n"]
    if not entries:
        lines.append("Nenhuma revisão verificável deste caminho na revisão Git consultada.\n")
        return "\n".join(lines)
    lines.extend(["| Data do commit | Revisão | Alteração registrada no Git |",
                  "|---|---|---|"])
    for entry in entries:
        sha=entry["sha"]
        lines.append(f"| {entry['date']} | [`{sha[:8]}`]({REPO}/commit/{sha}) | {safe_markdown_cell(entry['subject'])} |")
    lines.append("")
    return "\n".join(lines)

def render_traceability(records):
    if not records:
        return "Nenhuma ligação entre workpackage, Issue, commit, testes e aceite foi cadastrada para esta unidade. Não significa ausência de trabalho.\n"
    lines=["| ID da task | Workpackage | Issue / PR | Código / testes / deploy / aceite |",
           "|---|---|---|---|"]
    for rec in records:
        wp=rec["workpackage"]
        doc=wp["document"]
        links=f"[`{wp['id']}`]({REPO}/blob/main/{doc})"
        def ext(key):
            url=rec.get(key)
            return "[evidência]("+url+")" if url else "não vinculada"
        commit=rec.get("commit")
        commit_link=f"[`{commit[:8]}`]({REPO}/commit/{commit})" if commit else "não vinculado"
        proof="; ".join(["commit: "+commit_link,"testes: "+ext("testEvidence"),
                         "deploy: "+ext("deployment"),"aceite: "+ext("acceptance")])
        task=rec["workItem"]
        tasklink=f"[`{task['id']}`]({REPO}/blob/main/{task['document']})"
        lines.append(f"| {tasklink} | {links} | {ext('issue')} / {ext('pullRequest')} | {proof} |")
    lines+=["","**Importante:** tarefa identificada não implica requisito aprovado; vínculos ausentes não são completados por inferência."]
    return "\n".join(lines)+"\n"

def embed_provenance(units,revision):
    trace=read_traceability(units)
    for u in units:
        dest=CONTENT/site_rel(ROOT/Path(u["entry"]).parent/"HISTORICO.md")
        source=(ROOT/u["source"]).resolve()
        docs=(ROOT/Path(u["entry"]).parent).resolve()
        body=dest.read_text(encoding="utf-8")
        generated="\n".join([
            f"> Snapshot Git utilizado no build: `{revision[:12]}`. Fonte do módulo: `{u['source']}`.",
            "O caminho do catálogo pode ser compartilhado com outras unidades; os commits abaixo não representam ownership exclusivo.",
            history_table(source,"Alterações de código / artefatos do caminho do catálogo"),
            history_table(docs,"Alterações dos documentos deste módulo")])
        if "<!-- SYNDES-HISTORY-GENERATED -->" not in body or "<!-- SYNDES-TRACE-GENERATED -->" not in body:
            raise ValueError("Missing timeline insertion anchors for "+u["id"])
        body=body.replace("<!-- SYNDES-HISTORY-GENERATED -->",generated)
        body=body.replace("<!-- SYNDES-TRACE-GENERATED -->",render_traceability(trace[u["id"]]))
        dest.write_text(body,encoding="utf-8")

def embed_global_history(revision):
    path=CONTENT/"blueprint/LINHA-DO-TEMPO.md"
    body=path.read_text(encoding="utf-8")
    if "<!-- SYNDES-GLOBAL-HISTORY -->" not in body:
        raise ValueError("Missing global timeline anchor")
    compiled="\n".join([
        f"> Snapshot gerado do Git no commit `{revision[:12]}`; pode ficar defasado até a próxima publicação.",
        history_table(ROOT/"apps","Alterações recentes em aplicações"),
        history_table(ROOT/"modules","Alterações recentes em módulos"),
        history_table(ROOT/"docs","Alterações recentes na documentação"),
    ])
    path.write_text(body.replace("<!-- SYNDES-GLOBAL-HISTORY -->",compiled),encoding="utf-8")

def embed_code_inventory(units,revision):
    """Enrich rendered reference pages with source-derived evidence, never a deployed API claim."""
    from code_inventory import open_source_symbols,render
    directory=CONTENT/"assets/catalog"
    directory.mkdir(parents=True,exist_ok=True)
    payload=[]
    for u in units:
        data=open_source_symbols(u)
        data["revision"]=revision
        ref_page=CONTENT/site_rel(ROOT/u["technicalReference"])
        inventory=render(data)
        ref_page.write_text(ref_page.read_text(encoding="utf-8")+inventory,encoding="utf-8")
        metadata_path=ref_page.with_suffix(".sections.json")
        sections_data=json.loads(metadata_path.read_text(encoding="utf-8"))
        # Generated summaries are proposal targets only, never editable source lines.
        for section in markdown_sections(inventory):
            section["markdown"]="## "+section["heading"]+"\n\nInventário sintático, gerado a partir de "+u["source"]+". Não editar a saída diretamente.\n"
            section["position"]=0
            section["generated"]=True
            section["codeSource"]=u["source"]
            section["lastModified"]=None
            section["lastCommit"]=None
            section.pop("endLine",None)
            sections_data["sections"].append(section)
        metadata_path.write_text(json.dumps(sections_data,ensure_ascii=False),encoding="utf-8")
        (directory/(u["id"]+".json")).write_text(json.dumps(data,ensure_ascii=False),encoding="utf-8")
        base=Path(u["entry"]).parent.relative_to("docs")
        web="https://delmacy.github.io/syndes-system/"+base.as_posix()+"/"
        payload.append({"id":u["id"],"name":display_name(u),"canonicalName":u["name"],"area":u["front"],
                        "documentationParent":u.get("documentationParent"),
                        "source":u["source"],
                        "home":web,
                        "anchors":{"capabilities":web+"#capacidades",
                                   "stack":web+"CODIGO/",
                                   "publicContracts":web+"CONTRATOS/",
                                   "privateMethods":web+"CODIGO/",
                                   "http":web+"APIS/",
                                   "frontend":web+"CODIGO/",
                                   "database":web+"DADOS/",
                                   "dependencies":web+"DEPENDENCIAS/",
                                   "operation":web+"OPERACAO/",
                                   "quality":web+"STATUS/",
                                   "workpackages":web+"EVOLUCAO/",
                                   "history":web+"HISTORICO/",
                                   "agents":web+"#agentes"},
                        "symbolCount":len(data["declared"]),
                        "methodCount":len(data["methods"]),
                        "httpDecoratorCount":len(data["routes"]),
                        "frontendCandidateCount":len(data["frontendCandidates"]),
                        "sqlTableCount":sum(len(f["tables"]) for f in data["sql"]),
                        "publicExportCount":len(data["exports"]),
                        "dependencyCount":sum(len(v) for v in data["dependencies"].values()),
                        "searchTerms":sorted(set([x["name"] for x in data["declared"]]
                           +[x["name"] for x in data["methods"]]
                           +[t["name"] for f in data["sql"] for t in f["tables"]]
                           +[x["argument"] for x in data["routes"]]
                           +[name for group in data["dependencies"].values() for name in group])),
                        "inventory":"assets/catalog/"+u["id"]+".json"})
    (directory/"modules.json").write_text(json.dumps({"revision":revision,"modules":payload},ensure_ascii=False),encoding="utf-8")

def embed_portal_views(units, revision):
    """Compose module tabs and project data strictly from canonical source snapshots."""
    from portal_views import AREA_BY_ID
    association=json.loads((ROOT/"catalog/evolution-associations.json").read_text(encoding="utf-8"))
    source=association.get("source","")
    if not source.startswith("docs/engineering/") or not (ROOT/source).is_file():
        raise ValueError("Missing canonical program WBS source")
    registry=project_registry(units,association,display_name,revision,
                              "https://delmacy.github.io/syndes-system/")
    (CONTENT/"assets/catalog/projects.json").write_text(
        json.dumps(registry,ensure_ascii=False),encoding="utf-8")
    from topic_views import TAB_SPECS, topic_views
    from code_inventory import render as render_inventory
    pages=("index.md","ESCOPO.md","REFERENCIA-TECNICA.md",
           "EVOLUCAO.md","HISTORICO.md","OPERACAO.md","STATUS.md",
           "SPRINT.md","PROJECAO.md","IMPLEMENTACAO.md","ALTERACAO.md","PROMPTS.md")
    generated_pages=tuple(spec[0] for spec in TAB_SPECS)
    for unit in units:
        if unit.get("documentationParent"): continue
        folder=Path(unit["entry"]).parent.relative_to("docs")
        prompt=CONTENT/folder/"PROMPTS.md"
        prompt.write_text(scoped_prompts_page(unit,display_name(unit)),encoding="utf-8")

        # Independent page per technical category. Extracted evidence comes from the
        # versioned source/manifest; legacy reference keeps its original URL/anchors.
        source_reference=unit["technicalReference"]
        source_sections=json.loads((CONTENT/folder/"REFERENCIA-TECNICA.sections.json").read_text(encoding="utf-8"))["sections"]
        data=json.loads((CONTENT/"assets/catalog"/(unit["id"]+".json")).read_text(encoding="utf-8"))
        inventory_sections=markdown_sections(render_inventory(data))
        views=topic_views(unit["id"],display_name(unit),source_reference,
                          source_sections,inventory_sections,revision,unit["source"])
        if set(views)!=set(generated_pages): raise ValueError("Incomplete topic views for "+unit["id"])
        for filename,(body,metadata) in views.items():
            rendered=CONTENT/folder/filename
            marker=(f'<div class="syndes-source-marker" data-doc-source="{html.escape(source_reference,quote=True)}" '
                    f'data-doc-revision="{html.escape(revision,quote=True)}" '
                    f'data-doc-sections="../{html.escape(filename.removesuffix(".md"),quote=True)}.sections.json"></div>\n\n')
            edit_href=REPO+"/edit/main/"+source_reference
            rendered.write_text(marker+f"[✏️ Propor edição na referência original]({edit_href})\n\n"+body,encoding="utf-8")
            rendered.with_suffix(".sections.json").write_text(
                json.dumps(metadata,ensure_ascii=False),encoding="utf-8")

        for page in pages+generated_pages:
            rendered=CONTENT/folder/page
            if not rendered.is_file(): raise ValueError("Missing module document: "+str(rendered))
            raw=rendered.read_text(encoding="utf-8")
            tabs=module_tabs(unit,page)
            updated,count=re.subn(r"(?m)^(# .+)$",lambda m:m.group(1)+"\n\n"+tabs,raw,count=1)
            if count!=1: raise ValueError("Missing page heading: "+str(rendered))
            rendered.write_text(updated,encoding="utf-8")


def git_sha():
    try:
        return subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
    except (OSError,subprocess.CalledProcessError):
        return "unverified"

def site_navigation(units,canonical):
    """Seven user-facing sections; canonical module ownership remains unchanged."""
    navigation_tree(units,canonical) # validate ownership and documentationParent
    nav=[
        {"Início":"index.md"},
        {"Projetos":[
            {"Visão geral":"blueprint/PROJETOS.md"},
            {"WBS e workpackages":"blueprint/PROJETO-E-WORKPACKAGES.md"},
            {"Roadmap":"blueprint/ROADMAP.md"}]},
        {"Documentação":[
            {"Mapa técnico":"blueprint/MAPA-TECNICO-POR-CAMADAS.md"},
            {"Catálogo e busca":"blueprint/CATALOGO-MODULOS.md"},
            {"Arquitetura e contratos":"blueprint/index.md"}]},
        {"Módulos por área":grouped_navigation(units,display_name)},
        {"APIs e dados":[
            {"Catálogo de APIs":"blueprint/APIS.md"},
            {"Schemas e entidades":"blueprint/DADOS.md"},
            {"Contratos públicos":"standards/CONTRATOS-PUBLICOS.md"}]},
        {"Operações":[
            {"Monitoramento":"monitoramento/index.md"},
            {"Deploy e ambientes":"blueprint/AMBIENTES.md"}]},
        {"Guias e colaboração":[
            {"Padrões e organização":"standards/ORGANIZACAO-DE-PAGINAS.md"},
            {"Prompts para agentes":"standards/EDICAO-CONTEXTUAL.md"},
            {"GitHub Projects":"standards/GITHUB-PROJECTS.md"}]}
    ]
    seen=set()
    def verify(items):
        for item in items:
            for label,target in item.items():
                if isinstance(target,list):
                    verify(target)
                else:
                    if target in seen: raise ValueError("Duplicate portal route: "+target)
                    seen.add(target)
                    candidate=DOCS/target
                    if candidate.name=="index.md":
                        candidate=candidate.with_name("README.md")
                    if not candidate.is_file():
                        raise ValueError(f"Missing portal route {label}: {candidate}")
    verify(nav)
    return nav

def main():
    units=json.loads((DOCS/"subprojects/index.json").read_text())["units"]
    canonical=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
    assert len(units)==len(canonical)==57
    assert [u["id"] for u in units] == [u["id"] for u in canonical]
    include={DOCS/"README.md",DOCS/"subprojects/README.md",DOCS/"subprojects/index.json",DOCS/"monitoramento/README.md"}
    include.update((DOCS/"blueprint").glob("*.md"))
    include.update((DOCS/"standards").glob("*.md"))
    include.update((DOCS/"assets").glob("*"))
    for u in units:
        include.update((DOCS/Path(u["entry"]).parent.relative_to("docs")).glob("*.md"))
        include.update((DOCS/Path(u["entry"]).parent.relative_to("docs")/"chapters").rglob("*.md"))
        include.update((DOCS/Path(u["entry"]).parent.relative_to("docs")/"updates").rglob("*.md"))
    included={p.resolve() for p in include}
    if CONTENT.exists(): shutil.rmtree(CONTENT)
    CONTENT.mkdir(parents=True)
    revision=git_sha()
    for source in sorted(included):
        assert source.is_file(),source
        target=CONTENT/site_rel(source)
        target.parent.mkdir(parents=True,exist_ok=True)
        if source.suffix==".md":
            path=source.relative_to(ROOT).as_posix()
            raw=source.read_text(encoding="utf-8")
            marker=f'<div class="syndes-source-marker" data-doc-source="{path}" data-doc-revision="{revision}"></div>\n\n'
            target.write_text(marker+"[✏️ Editar arquivo original no GitHub](https://github.com/delmacy/syndes-system/edit/main/"+path+")\n\n"+rewrite_links(raw,source,included),encoding="utf-8")
            sections=annotate_revisions(markdown_sections(raw),raw,blame_revisions(source))
            payload={"source":path,"revision":revision,"sections":sections}
            if source.name in ("PROJECAO.md","IMPLEMENTACAO.md","ALTERACAO.md"):
                payload["fullMarkdown"]=raw
            target.with_suffix(".sections.json").write_text(json.dumps(payload,ensure_ascii=False),encoding="utf-8")
        else: shutil.copy2(source,target)
    embed_chapters_in_scopes(units,revision,included)
    embed_provenance(units,revision)
    embed_global_history(revision)
    embed_code_inventory(units,revision)
    embed_portal_views(units,revision)
    nav=site_navigation(units,canonical)
    config={
        "site_name":"Syndes Docs",
        "site_description":"Documentação técnica do Syndes System",
        "site_url":"https://delmacy.github.io/syndes-system/",
        "repo_url":REPO,"repo_name":"delmacy/syndes-system",
        "edit_uri":"edit/main/docs/",
        "docs_dir":str(CONTENT),"site_dir":str(OUT/"site"),
        "theme":{"name":"material","language":"pt-BR",
                 "logo":"assets/syndes-mark.svg","favicon":"assets/syndes-mark.svg",
                 "features":["navigation.top","toc.follow",
                             "search.suggest","search.highlight",
                             "content.code.copy"],
                 "palette":[
                     {"scheme":"default","primary":"indigo","accent":"deep purple",
                      "toggle":{"icon":"material/brightness-7","name":"Ativar modo escuro"}},
                     {"scheme":"slate","primary":"indigo","accent":"deep purple",
                      "toggle":{"icon":"material/brightness-4","name":"Ativar modo claro"}}]},
        "markdown_extensions":["admonition","attr_list","md_in_html","tables",
             {"toc":{"permalink":True}},
             {"pymdownx.superfences":{"custom_fences":[
                 {"name":"mermaid","class":"mermaid",
                  "format":"!!python/name:pymdownx.superfences.fence_code_format"}]}},
             "pymdownx.details","pymdownx.tasklist","pymdownx.highlight",
             "pymdownx.inlinehilite"],
        "plugins":["search"],"extra_css":["assets/syndes.css"],"extra_javascript":["assets/topic-editor.js","assets/workflows.js","assets/module-directory.js","assets/projects-dashboard.js","assets/module-nav.js"],"nav":nav
    }
    OUT.mkdir(exist_ok=True)
    mkdocs_yaml = yaml.safe_dump(config,allow_unicode=True,sort_keys=False,width=106)
    mkdocs_yaml = mkdocs_yaml.replace("format: '!!python/name:pymdownx.superfences.fence_code_format'", "format: !!python/name:pymdownx.superfences.fence_code_format")
    (OUT/"mkdocs.yml").write_text(mkdocs_yaml)
    print("Generated:",len(included),"files;",len(units),"work units")

if __name__=="__main__":main()
