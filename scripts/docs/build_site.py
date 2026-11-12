#!/usr/bin/env python3
"""Build a selected Markdown book; never publish arbitrary repo docs/configuration."""
from pathlib import Path
import json, re, shutil, yaml
import subprocess

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
        result.append({"position":line_number+1,"level":level,"heading":title,"markdown":value})
    return result

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
    include={DOCS/"README.md",DOCS/"blueprint/README.md",DOCS/"subprojects/README.md",DOCS/"subprojects/index.json"}
    include.update((DOCS/"standards").glob("*.md"))
    include.update((DOCS/"assets").glob("*"))
    for u in units:
        include.update((DOCS/Path(u["entry"]).parent.relative_to("docs")).glob("*.md"))
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
            sections=markdown_sections(raw)
            target.with_suffix(".sections.json").write_text(json.dumps({"source":path,"revision":revision,"sections":sections},ensure_ascii=False),encoding="utf-8")
        else: shutil.copy2(source,target)
    nav=[{"Início":"index.md"},{"Blueprint":"blueprint/index.md"}]
    for id,label in FRONTS:
        group=[]
        for u in units:
            if u["front"]!=id: continue
            d=Path(u["entry"]).parent.relative_to("docs")
            pages=[{"Visão geral":str(d/"index.md")},
                   {"Escopo":str(d/"ESCOPO.md")},
                   {"Status":str(d/"STATUS.md")},
                   {"Sprint":str(d/"SPRINT.md")}]
            for prompt,name in [("PROJECAO.md","Prompt de projeção"),("IMPLEMENTACAO.md","Prompt de implementação")]:
                if (DOCS/d/prompt).is_file(): pages.append({name:str(d/prompt)})
            group.append({u["id"]+" · "+u["name"]:pages})
        nav.append({label:group})
    nav.extend([{"Contratos e padrões":[
        {"Contratos públicos":"standards/CONTRATOS-PUBLICOS.md"},
        {"Editar tópicos e enviar propostas":"standards/EDICAO-CONTEXTUAL.md"},
        {"Modelo de contrato":"standards/TEMPLATE-CONTRATO-PUBLICO.md"},
        {"Modelo de projeção":"standards/PROMPT-PROJECAO.md"},
        {"Modelo de implementação":"standards/PROMPT-IMPLEMENTACAO.md"}]},
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
        "plugins":["search"],"extra_css":["assets/syndes.css"],"extra_javascript":["assets/topic-editor.js"],"nav":nav
    }
    OUT.mkdir(exist_ok=True)
    mkdocs_yaml = yaml.safe_dump(config,allow_unicode=True,sort_keys=False,width=106)
    mkdocs_yaml = mkdocs_yaml.replace("format: '!!python/name:pymdownx.superfences.fence_code_format'", "format: !!python/name:pymdownx.superfences.fence_code_format")
    (OUT/"mkdocs.yml").write_text(mkdocs_yaml)
    print("Generated:",len(included),"files;",len(units),"work units")

if __name__=="__main__":main()
