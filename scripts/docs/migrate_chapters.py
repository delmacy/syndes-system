#!/usr/bin/env python3
"""One-time migration: split existing ESCOPO H2 chapters into source-owned Markdown.
Preserves content; ESCOPO becomes a stable entry/index instead of duplicating chapters.
"""
from pathlib import Path
import json,re,unicodedata,urllib.parse

ROOT=Path(__file__).resolve().parents[2]
INDEX=json.loads((ROOT/"docs/subprojects/index.json").read_text(encoding="utf8"))["units"]
DOCS=ROOT/"docs"

def slug(name):
    name="".join(c for c in unicodedata.normalize("NFKD",name) if not unicodedata.combining(c))
    return re.sub("-+","-",re.sub(r"[^a-zA-Z0-9]+","-",name.lower())).strip("-")[:64].rstrip("-")

def split_h2(source):
    lines=source.splitlines(keepends=True)
    positions=[]
    fence=None
    for i,line in enumerate(lines):
        trimmed=line.lstrip()
        mark=re.match(r"^(`{3,}|~{3,})",trimmed)
        if mark:
            token=mark.group(1)
            if fence is None:fence=token
            elif token[0]==fence[0] and len(token)>=len(fence):fence=None
            continue
        if not fence:
            m=re.match(r"^##\s+(.*?)\s*#*\s*$",line)
            if m:positions.append((i,m.group(1).strip()))
    chapters=[]
    for pos,(start,title) in enumerate(positions):
        end=positions[pos+1][0] if pos+1<len(positions) else len(lines)
        chapters.append((title,"".join(lines[start:end])))
    intro="".join(lines[:positions[0][0]]) if positions else source
    return intro,chapters

def rebase_links(text):
    def replace(m):
        label,url=m.groups()
        if url.startswith(("http:","https:","mailto:","tel:","#","/")):return m.group()
        return "["+label+"](../"+url+")"
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",replace,text)

def migrate(unit):
    uid=unit["id"]
    d=ROOT/Path(unit["scope"]).parent
    scope=d/"ESCOPO.md"
    original=scope.read_text(encoding="utf8")
    if "SYNDES-DOCS-CHAPTER-INDEX:1" in original:
        return 0
    intro,parts=split_h2(original)
    if not parts:raise ValueError("No chapters found "+uid)
    if len(parts)<4:raise ValueError("Unusually short scope "+uid)
    # CRM has a descriptive initial H2: keep it as part of the index preface.
    if uid=="P01" and parts[0][0].startswith("ESCOPO DE SUBPROJETO"):
        intro+=parts[0][1]
        parts=parts[1:]
    folder=d/"chapters"
    folder.mkdir(exist_ok=True)
    index=[]
    for n,(title,body) in enumerate(parts):
        numbered=re.match(r"^([0-9]{1,2})\.\s*(.*)$",title)
        number=int(numbered.group(1)) if numbered else (max([int(re.match(r"^(\d+)",x[0]).group(1)) for x in parts[:n] if re.match(r"^(\d+)",x[0])],default=n-1)+1)
        suffix=numbered.group(2) if numbered else title
        filename=f"{number:02d}-{slug(suffix)}.md"
        target=folder/filename
        if target.exists():
            raise FileExistsError("Refusing to overwrite "+str(target))
        body=rebase_links(body).strip()+"\n"
        target.write_text(body,encoding="utf8")
        index.append((title,filename))
    tail="\n---\n\n<!-- SYNDES-DOCS-CHAPTER-INDEX:1 -->\n## Índice de capítulos (fonte canônica por assunto)\n\n"
    tail+="Cada capítulo abaixo é um arquivo Markdown independente. **Este índice não replica requisitos nem aprova funcionalidades.**\n\n"
    for title,path in index:
        tail+=f"- [{title}](chapters/{path})\n"
    tail+=f"""
## Solicitações e atualizações

- [Atualizações, novas capacidades e histórias de usuário](updates/README.md)
- [Status e evidências](STATUS.md)
- [Sprint atual e checkpoints](SPRINT.md)
- [Prompt de projeção](PROJECAO.md)
- [Prompt de implementação](IMPLEMENTACAO.md)

**Estado:** preservar o baseline e a aprovação indicados acima. Dividir arquivos não representa autorização para implementar, remover ou homologar funcionalidades. Ao citar um assunto, indicar o **caminho exato** em `chapters/`, não apenas este índice.
"""
    scope.write_text(intro.rstrip()+"\n"+tail,encoding="utf8")
    return len(parts)

def update_inbox(unit):
    uid=unit["id"]
    name=unit["name"]
    d=ROOT/Path(unit["scope"]).parent
    p=d/"updates/README.md"
    p.parent.mkdir(exist_ok=True)
    if p.exists():return
    canonical=unit["scope"]
    q=urllib.parse.quote(f'is:issue is:open "[Syndes Docs][{uid}]"')
    p.write_text(f"""# {uid} — {name} | Atualizações e propostas

> **Caixa de entrada lógica.** A origem das sugestões é a Issue do GitHub; este índice não significa requisito aprovado.

## Adicionar uma capacidade, história ou alteração

Abra o [índice de capítulos](../ESCOPO.md), escolha o assunto e clique **Propor alteração neste tópico** → **Copiar prompt de projeção** ou **Enviar à caixa de entrada**.

Para ideia sem tópico existente, escolha a área apropriada: capacidades, requisitos/histórias, integração, banco, UX ou qualidade. Não altere o Markdown normativo diretamente para registrar uma ideia que ainda precisa de discussão.

- [Abrir a caixa de entrada desta unidade no GitHub](https://github.com/delmacy/syndes-system/issues?q={q})
- [Criar nova solicitação no GitHub](https://github.com/delmacy/syndes-system/issues/new)
- [Prompt de projeção desta unidade](../PROJECAO.md)
- [Prompt de implementação desta unidade](../IMPLEMENTACAO.md)

**Identificação obrigatória:** `[Syndes Docs][{uid}]` no título, caminho do capítulo, seção/tópico, SHA da fonte, descrição da proposta e objetivo.

## Fluxo de aprovação

`PROPOSTA → EM ANÁLISE → ESCLARECIMENTO → APROVADA → PRONTA PARA IMPLEMENTAÇÃO → IMPLEMENTADA → TESTADA / ACEITA`.

**Nunca** tratar uma issue ou sugestão como autorização automática para executar código. Após sua aprovação explícita, o agente de projeção atualiza o capítulo de destino e cria a especificação de implementação versionada nesta pasta, por exemplo `updates/{uid}-UPD-0001.md`, usando `docs/standards/TEMPLATE-ATUALIZACAO.md`. A implementação só começa quando a atualização possui critérios de aceite e a autorização correspondente; ao concluir, atualizar STATUS e SPRINT.

**Escopo resumido:** [ESCOPO.md](../ESCOPO.md) (`{canonical}`).
""",encoding="utf8")

def main():
    counts={}
    for u in INDEX:
        counts[u["id"]]=migrate(u)
        update_inbox(u)
        d=ROOT/Path(u["scope"]).parent
        p=d/"README.md"
        orig=p.read_text(encoding="utf8")
        addition="\n7. **Assuntos editáveis:** [Capítulos da especificação](ESCOPO.md) · [Atualizações e propostas](updates/README.md).\n"
        if "Atualizações e propostas" not in orig:p.write_text(orig.rstrip()+"\n"+addition,encoding="utf8")
    print("Migrated units:",len(counts),"total chapters:",sum(counts.values()),"P01:",counts["P01"],"P02:",counts["P02"])
if __name__=="__main__":main()
