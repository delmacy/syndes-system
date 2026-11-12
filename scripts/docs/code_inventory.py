#!/usr/bin/env python3
"""Read-only source inventory. Never equate declarations with deployed/public APIs."""
from pathlib import Path
import json
import re
import html
import sys

ROOT=Path(__file__).resolve().parents[2]
REPO="https://github.com/delmacy/syndes-system"
DECL=re.compile(r'^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(class|interface|enum|type|function)\s+([A-Za-z_]\w*)')
METHOD=re.compile(r'^\s*(?:(?:public|protected|private|static|readonly|async|override|abstract|declare)\s+)*(?:get\s+|set\s+)?([A-Za-z_]\w*)\s*(?:<[^>{}]*>)?\s*\(')
ROUTE=re.compile(r'@\s*(Controller|Get|Post|Put|Patch|Delete|Head|Options)\s*\(([^)]{0,130})\)')
TABLE=re.compile(r'\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["\w]+\.)?["]?([\w]+)["]?', re.I)
EXTERNAL=REPO+"/blob/main/"
def full(u):
    return ROOT/u["source"]
def scan_files(u):
    source=full(u)
    parts=Path(u["source"]).parts
    # Aggregate ownership directories are too broad to assign all declarations to one unit.
    scoped=(len(parts)>=2 and parts[0] in ("modules","apps","packages") and parts[1] not in ("",))
    if source.is_file():
        return [source] if source.suffix in (".ts",".tsx",".go",".sql") else []
    if not source.is_dir() or not scoped:return []
    files=[]
    for folder in ("src",):
        base=source/folder
        if base.exists():
            files.extend(f for f in base.rglob("*") if f.suffix in (".ts",".tsx") and not f.name.endswith(".d.ts"))
    if u["id"]=="P03":
        go=source/"gateway/whatsmeow"
        if go.exists():
            files.extend(f for f in go.glob("*.go") if not f.name.endswith("_test.go"))
    return sorted(files)
def to_ref(path,line=None):
    rel=path.relative_to(ROOT).as_posix()
    return EXTERNAL+rel+(f"#L{line}" if line else "")
def open_source_symbols(u):
    files=scan_files(u)
    pkg_path=full(u)/"package.json"
    pkg=json.loads(pkg_path.read_text()) if pkg_path.is_file() else None
    manifest_exports=pkg.get("exports",{}) if pkg else {}
    if not isinstance(manifest_exports,dict):manifest_exports={".":manifest_exports}
    idx=full(u)/"src/index.ts"
    public_index=idx.read_text(encoding="utf8") if idx.is_file() else ""
    public_paths=set()
    for subpath,val in manifest_exports.items():
        targets=[]
        if isinstance(val,str):targets=[val]
        elif isinstance(val,dict):targets=[v for v in val.values() if isinstance(v,str)]
        for target in targets:
            p=target.replace("./dist/","src/").replace(".js",".ts").replace(".d.ts",".ts")
            public_paths.add(p)
    declared=[];methods=[];routes=[];go=[]
    for f in files:
        rel=f.relative_to(ROOT).as_posix()
        lines=f.read_text(encoding="utf-8",errors="replace").splitlines()
        path_relative=f.relative_to(full(u)).as_posix() if full(u).is_dir() else f.name
        for i,line in enumerate(lines,1):
            found=DECL.match(line)
            if found:
                kind,name=found.groups()
                exported=bool(re.match(r'^\s*export\b',line))
                reachable=(path_relative in public_paths or (
                    public_index and exported and (re.search(r'\b'+re.escape(name)+r'\b',public_index)
                    or re.search(r'from\s+["\']\./'+re.escape(Path(path_relative).stem)+r'\.js',public_index))))
                declared.append(dict(kind=kind,name=name,file=rel,line=i,
                                    fileExport=exported,
                                    exposure="entrypoint-candidate" if reachable else "internal-declaration"))
            for m in ROUTE.finditer(line):
                routes.append(dict(decorator=m.group(1),argument=m.group(2).strip()[:80],file=rel,line=i))
            if f.suffix==".go":
                m=re.match(r'^\s*(type|func)\s+(?:\([^)]*\)\s*)?([A-Z][A-Za-z0-9_]*)\b',line)
                if m:go.append(dict(kind=m.group(1),name=m.group(2),file=rel,line=i))
        # Methods at class surface (best effort lexical extraction, not TypeScript type-check).
        class_start=None;depth=0
        for i,line in enumerate(lines,1):
            if class_start is None:
                match=re.search(r'\bclass\s+([A-Za-z_]\w*)',line)
                if match:
                    class_start=match.group(1)
                    depth=line.count("{")-line.count("}")
                continue
            # top-level class method signatures only, not arbitrary calls within methods.
            if depth==1 and not line.lstrip().startswith(("//","*","@","return","throw","if ","while ","for ")):
                m=METHOD.match(line)
                if m and m.group(1) not in ("if","for","while","switch","catch","super"):
                    kind="private" if re.search(r'\bprivate\b',line.split("(",1)[0]) else (
                         "protected" if re.search(r'\bprotected\b',line.split("(",1)[0]) else "class-surface")
                    methods.append(dict(className=class_start,name=m.group(1),visibility=kind,
                                        file=rel,line=i,signature=line.strip()[:160]))
            depth+=line.count("{")-line.count("}")
            if depth<=0:class_start=None
    sql=[]
    src=full(u)
    for f in sorted((src/"sql").glob("*.sql")) if src.is_dir() else ([src] if src.suffix==".sql" else []):
        lines=f.read_text(encoding="utf-8",errors="replace").splitlines()
        sql.append(dict(file=f.relative_to(ROOT).as_posix(),tables=[
            dict(name=m.group(1),line=i) for i,line in enumerate(lines,1) for m in TABLE.finditer(line)]))
    front=[]
    # Names are discovery hints only. No route/permissions are inferred.
    slug=Path(u["source"]).name
    names={"P01":["crm"],"P02":["inbox"],"P03":["whatsapp"],"P04":["organization","team","staff"]}.get(u["id"],[slug])
    if u["id"].startswith(("P","A")) and src.parts[-1] not in ("modules","apps"):
        for app in ("workspace-web","master-admin-web","support-web"):
            features=ROOT/"apps"/app/"src/features"
            if features.is_dir():
                for f in sorted(features.rglob("*.tsx")):
                    if any(part in f.name.lower() for part in names):
                        front.append(dict(app=app,file=f.relative_to(ROOT).as_posix()))
    return dict(moduleId=u["id"],source=u["source"],scanMode="source-declarations-only",
                exports=manifest_exports,filesScanned=len(files),declared=declared,
                methods=methods,routes=routes,sql=sql,frontendCandidates=front,go=go)
def esc(v):
    return html.escape(str(v),quote=False).replace("|",r"\|")
def link(t,path,line=None):
    return f"[{esc(t)}]({EXTERNAL}{path}"+(f"#L{line}" if line else "")+")"
def table(head,rows,empty):
    if not rows:return "\n"+empty+"\n"
    return "\n"+"| "+" | ".join(head)+" |\n|"+ "|".join("---" for _ in head)+"|\n"+"\n".join(
        "| "+" | ".join(row)+" |" for row in rows)+"\n"
def render(d):
    text=f"""

---

## Inventário extraído do código {{#inventario-codigo}}

> **Extração sintática, não auditoria nem prova de deploy.** Fonte: `{d['source']}`; arquivos TypeScript/Go examinados: **{d['filesScanned']}**. Os métodos listados são declarações encontradas em arquivos, não necessariamente exports de pacote ou métodos invocáveis externamente.

### Contratos públicos declarados pelo pacote {{#pacote-publico}}

"""
    rows=[]
    for route,target in d["exports"].items():
        value=target if isinstance(target,str) else json.dumps(target,ensure_ascii=False)
        rows.append([f"`{esc(route)}`",f"`{esc(value)}`","Manifesto de package; ativação/compatibilidade não verificadas"])
    text+=table(["Entry point","Target","Estado"],rows,"Nenhum package.json#exports identificado neste escopo.")
    text+="""

### Classes, interfaces e tipos encontrados {{#classes-e-interfaces}}

A classe `export` no arquivo não significa contrato `public` entre módulos. **entrypoint-candidate** indica declaração potencialmente atingível pelos exports; demais declarações continuam internas até revisão de `package.json` e `src/index.ts`.
"""
    rows=[[esc(x["kind"]),link(x["name"],x["file"],x["line"]),
           esc(x["exposure"])] for x in d["declared"]]
    text+=table(["Tipo","Declaração com arquivo/linha","Visibilidade de pacote estimada"],rows,
                "Nenhuma declaração de classe/interface/tipo nesta fonte, ou código sob outro owner.")
    text+="""

### Métodos de classes e visibilidade interna {{#metodos}}

Métodos **private/protected** não pertencem ao contrato público. `class-surface` significa método de classe; o acesso entre módulos depende da visibilidade da **classe no entrypoint**. Assinaturas parciais são guias de localização para o agente.
"""
    rows=[[esc(x["className"]),link(x["name"],x["file"],x["line"]),esc(x["visibility"]),
           f"`{esc(x['signature'])}`"] for x in d["methods"]]
    text+=table(["Classe","Método","Visibilidade TS","Assinatura (linha fonte)"],rows,
                "Nenhum método identificado por este extrator conservador. Consultar o código.")
    text+="""

### Endpoints HTTP anotados {{#endpoints-http}}

Decorators NestJS encontrados no código; caminhos finais, autenticação, módulos habilitados e permissões **precisam ser verificados no Host**.
"""
    rows=[[link(x["decorator"],x["file"],x["line"]),f"`{esc(x['argument'])}`"] for x in d["routes"]]
    text+=table(["Decorator e fonte","Argumento literal"],rows,"Nenhum decorator HTTP identificado diretamente nesta fonte.")
    text+="""

### Frontend identificado por arquivo candidato {{#frontend-identificado}}

São arquivos existentes cujos nomes correspondem ao domínio; isso **não confirma a rota publicada** nem os grants.
"""
    rows=[[esc(x["app"]),link(Path(x["file"]).name,x["file"])] for x in d["frontendCandidates"]]
    text+=table(["Aplicação","Componente/arquivo"],rows,"Nenhum candidato de frontend encontrado por nome nesta análise; conferir composição real.")
    text+="""

### Schemas e arquivos SQL {{#schemas-sql}}

SQL é fonte de definição; a presença no repositório **não prova execução da migration** nem destino físico (Tenant DB ou Control DB). Confirmar manifesto do owner.
"""
    rows=[]
    for x in d["sql"]:
        if x["tables"]:
            for t in x["tables"]:
                rows.append([link(Path(x["file"]).name,x["file"],t["line"]),f"`{esc(t['name'])}`","Destino/versão aplicada: a confirmar"])
        else:rows.append([link(Path(x["file"]).name,x["file"]),"—","Migration presente; não inferir tabela"])
    text+=table(["Arquivo","Tabela declarada","Estado"],rows,"Nenhum SQL diretamente no escopo deste módulo.")
    if d["go"]:
        text+="""

### Gateway Go: funções e tipos exportados {{#gateway-go}}

Funções e tipos Go iniciados com letra maiúscula, localizados dentro do sidecar do WhatsApp. **Exportado no pacote Go não significa API pública HTTP/SaaS.**
"""
        rows=[[esc(x["kind"]),link(x["name"],x["file"],x["line"])] for x in d["go"]]
        text+=table(["Tipo","Símbolo Go"],rows,"Nenhum símbolo Go encontrado.")
    text+="""

### Consulta estruturada para agentes {{#registro-para-agentes}}

O índice JSON de inventário do módulo fica em `assets/catalog/<ID>.json` (substituir `<ID>` pelo identificador do módulo). Para uma pergunta de capability, iniciar em [Especificação](ESCOPO.md). Para chamada entre módulos, verificar `package.json#exports` e contratos versionados antes de importar uma classe. Valores de segredos, hosts e dados de clientes não integram esta extração.

"""
    return text.replace("<ID>",d["moduleId"])
if __name__=="__main__":
    catalog=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
    for uid in sys.argv[1:] or ["P01","P02","P03","P04","A04","A08"]:
        print(uid, [(k,len(v) if isinstance(v,list) else v) for k,v in open_source_symbols(next(x for x in catalog if x["id"]==uid)).items() if k in ("filesScanned","declared","methods","routes","sql","frontendCandidates","go")])
