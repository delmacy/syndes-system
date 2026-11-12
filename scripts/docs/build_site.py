#!/usr/bin/env python3
"""Build a selected Markdown book; never publish arbitrary repo docs/configuration."""
from pathlib import Path
import json, re, shutil, yaml
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
OUT = ROOT / ".docs-site"
CONTENT = OUT / "content"
REPO = "https://github.com/delmacy/syndes-system"
FRONTS = [(x["id"],x["name"]) for x in json.loads((ROOT/"catalog/work-units.json").read_text())["fronts"]]

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
        m=re.match(r"^(#{1,4})\s+(.+?)\s*#*\s*$",line)
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
    """Exactly three levels: area > module > page. Topic headings belong in page body."""
    if len(units) != len(canonical):
        raise ValueError("Catalog size mismatch")
    canonical_by_id={u["id"]:u for u in canonical}
    ids=set()
    nav=[]
    for front_id, front_label in FRONTS:
        modules=[]
        for unit in units:
            if unit["front"]!=front_id: continue
            uid=unit["id"]
            if uid in ids or uid not in canonical_by_id or canonical_by_id[uid]["front"]!=front_id:
                raise ValueError("Invalid owner or duplicate unit "+uid)
            ids.add(uid)
            d=Path(unit["entry"]).parent.relative_to("docs")
            pages=[
                {"Visão geral":str(d/"index.md")},
                {"Escopo":str(d/"ESCOPO.md")},
                {"Evolução":str(d/"EVOLUCAO.md")},
                {"Status":str(d/"STATUS.md")},
                {"Sprint":str(d/"SPRINT.md")},
                {"Atualizações":str(d/"updates/index.md")},
                {"Projeção / Planejamento":str(d/"PROJECAO.md")},
                {"Implementação":str(d/"IMPLEMENTACAO.md")},
                {"Alteração rápida":str(d/"ALTERACAO.md")},
            ]
            modules.append({uid+" · "+unit["name"]:pages})
        nav.append({front_label:modules})
    if ids!=set(canonical_by_id):
        raise ValueError("Missing or duplicate units in three-level navigation")
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

def git_sha():
    try:
        return subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
    except (OSError,subprocess.CalledProcessError):
        return "unverified"

def main():
    units=json.loads((DOCS/"subprojects/index.json").read_text())["units"]
    canonical=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
    assert len(units)==len(canonical)==57
    assert [u["id"] for u in units] == [u["id"] for u in canonical]
    include={DOCS/"README.md",DOCS/"blueprint/README.md",DOCS/"subprojects/README.md",DOCS/"subprojects/index.json",DOCS/"monitoramento/README.md"}
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
    nav=[{"Início":"index.md"},{"Monitoramento":"monitoramento/index.md"},
         {"Blueprint":"blueprint/index.md"}]
    nav.extend(navigation_tree(units,canonical))
    nav.extend([{"Contratos e padrões":[
        {"Contratos públicos":"standards/CONTRATOS-PUBLICOS.md"},
        {"Editar tópicos e enviar propostas":"standards/EDICAO-CONTEXTUAL.md"},
        {"Organização por subpáginas":"standards/ORGANIZACAO-DE-PAGINAS.md"},
        {"Modelo de contrato":"standards/TEMPLATE-CONTRATO-PUBLICO.md"},
        {"Modelo de projeção":"standards/PROMPT-PROJECAO.md"},
        {"Modelo de implementação":"standards/PROMPT-IMPLEMENTACAO.md"},
        {"Fluxo de atualizações":"standards/FLUXO-DE-ATUALIZACOES.md"},
        {"Modelo de atualização":"standards/TEMPLATE-ATUALIZACAO.md"},
        {"Modelo de workpackage":"standards/TEMPLATE-WORKPACKAGE.md"},
        {"Modelo de prompt por incremento":"standards/TEMPLATE-PROMPT-INCREMENTO.md"}]},
        {"Índice por caminho":"subprojects/index.md"}])
    config={
        "site_name":"Syndes Docs",
        "site_description":"Documentação técnica do Syndes System",
        "site_url":"https://delmacy.github.io/syndes-system/",
        "repo_url":REPO,"repo_name":"delmacy/syndes-system",
        "edit_uri":"edit/main/docs/",
        "docs_dir":str(CONTENT),"site_dir":str(OUT/"site"),
        "theme":{"name":"material","language":"pt-BR",
                 "logo":"assets/syndes-mark.svg","favicon":"assets/syndes-mark.svg",
                 "features":["navigation.sections","navigation.indexes",
                             "navigation.top","toc.follow","search.suggest","search.highlight",
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
        "plugins":["search"],"extra_css":["assets/syndes.css"],"extra_javascript":["assets/topic-editor.js","assets/workflows.js"],"nav":nav
    }
    OUT.mkdir(exist_ok=True)
    mkdocs_yaml = yaml.safe_dump(config,allow_unicode=True,sort_keys=False,width=106)
    mkdocs_yaml = mkdocs_yaml.replace("format: '!!python/name:pymdownx.superfences.fence_code_format'", "format: !!python/name:pymdownx.superfences.fence_code_format")
    (OUT/"mkdocs.yml").write_text(mkdocs_yaml)
    print("Generated:",len(included),"files;",len(units),"work units")

if __name__=="__main__":main()
