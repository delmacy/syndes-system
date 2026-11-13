#!/usr/bin/env python3
"""Enhance the experimental Starlight edition without altering canonical documentation.

All links and source text come from the versioned docs/subprojects catalog.
States must only be quoted from STATUS, not inferred from file existence.
"""
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs'
CAT = json.loads((DOCS/'subprojects/index.json').read_text(encoding='utf-8'))['units']
BASE = ROOT/'experiments/book-ab/starlight/src/content/docs'
AREAS = {
 'produto':('01-produto','Produto e módulos de negócio','Funcionalidades, processos e integrações de negócio.'),
 'plataforma':('02-plataforma','Plataforma e core','Orquestração, contratos e serviços compartilhados.'),
 'frontend':('03-interfaces','Interfaces e aplicações','Experiências do usuário e superfícies de administração.'),
 'operacao':('04-operacao','Operação e negócios','Processos operacionais, suporte e gestão.'),
 'qualidade':('05-infra-qualidade','Infraestrutura e qualidade','Hospedagem, segurança, testes e gates de entrega.'),
}
TOPICS = [
 ('00','Fontes e endereços','00-enderecos-exatos-de-leitura.md'),
 ('01','Missão e fronteiras','01-missao-objetivos-e-fronteiras.md'),
 ('02','Requisitos e casos de uso','02-requisitos-historias-e-casos-de-uso.md'),
 ('03','Capacidades','03-capabilities.md'),
 ('04','Contratos e dependências','04-contratos-e-dependencias-publicas.md'),
 ('05','Arquitetura, dados e interfaces','05-arquitetura-banco-interface-configuracao-e-diagramas.md'),
 ('06','WBS e critérios de aceite','06-wbs-marcos-e-aceite.md'),
 ('07','Controle de escopo','07-controle-do-escopo.md'),
]
PREFIX='https://github.com/delmacy/syndes-system/blob/main/'

def gh(p):
    return PREFIX+quote(p.relative_to(ROOT).as_posix(),safe='/')

def yml(s):
    return json.dumps(s,ensure_ascii=False)

def safe_excerpt(p,limit=350):
    if not p.is_file():
        return 'Documento ainda não encontrado na fonte catalogada.'
    txt=p.read_text(encoding='utf-8')
    txt=re.sub(r'^\s*#{1,6} .+$','',txt,flags=re.M)
    txt=re.sub(r'\[([^\]]+)\]\([^)]+\)',r'\1',txt)
    txt=re.sub(r'[`*_<>|]','',txt)
    txt=' '.join(txt.split())
    return txt[:limit].rsplit(' ',1)[0]+'…' if len(txt)>limit else txt

def source_markdown(raw,path):
    """Make relative references point to their real versioned source, not fictitious preview pages."""
    def rewrite(m):
        label,url=m.group(1),m.group(2)
        if url.startswith(('http:','https:','mailto:','tel:','#','data:')):
            return m.group(0)
        target,hashmark,fragment=url.partition('#')
        if not target:
            return m.group(0)
        candidate=(path.parent/target).resolve()
        if candidate.is_relative_to(ROOT):
            return '['+label+']('+gh(candidate)+(hashmark+fragment if hashmark else '')+')'
        return m.group(0)
    return re.sub(r'\[([^\]\n]+)\]\(([^\s)]+)\)',rewrite,raw)

def frontmatter(title,description):
    return f'---\ntitle: {yml(title)}\ndescription: {yml(description)}\ndraft: false\n---\n\n'

def enrich():
    if len(CAT)!=57 or len({u['id'] for u in CAT})!=57:
        raise ValueError('Canonical catalog has changed; reconcile before changing edition')
    chapter_index=[]
    for area,(volume,title,tagline) in AREAS.items():
        group=[u for u in CAT if u['front']==area]
        volume_path=BASE/volume/'index.md'
        volume_path.parent.mkdir(parents=True,exist_ok=True)
        lines=[frontmatter('Volume — '+title,tagline),f'# {title}','',tagline,'','**Capítulos:** '+str(len(group)), '', '## Sumário do volume','']
        for u in group:
            lines.append(f'- [{u["id"]} · {u["name"]}](./{u["id"].lower()}/) — origem `{u["source"]}`')
        lines+=['','---','[Voltar à biblioteca](../)']
        volume_path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
        for u in group:
            uid=u['id']; slug=uid.lower()
            source=ROOT/u['entry']; folder=source.parent
            status=ROOT/u['status']; tech=ROOT/u['technicalReference']; oper=ROOT/u['operation']
            title=uid+' — '+u['name']
            full=frontmatter(title, f'Ficha técnica uniformizada do capítulo {uid}, volume {AREAS[area][1]}')
            full+=f'# {title}\n\n[← Sumário do volume](../) · [↑ Biblioteca](../../)\n\n'
            full+='> **Leitura técnica, não homologação.** Estados, limites e comprovações devem ser lidos em STATUS e nos checkpoints versionados.\n\n'
            full+='## Identificação e rastreabilidade\n\n'
            full+='| Campo | Fonte verificável |\n|---|---|\n'
            full+=f'| Unidade / owner | **{uid}** · {u["name"]} |\n'
            full+=f'| Volume | {AREAS[area][1]} |\n'
            full+=f'| Caminho de implementação | `{u["source"]}` |\n'
            full+=f'| Documento de origem | [README]({gh(source)}) |\n'
            full+=f'| STATUS e critérios | [STATUS original]({gh(status)}) |\n'
            full+=f'| Símbolos, APIs, SQL e dependências | [REFERENCIA-TECNICA]({gh(tech)}) |\n'
            full+=f'| Implantação, runbooks e gates | [OPERACAO]({gh(oper)}) |\n'
            if u.get('documentationParent'):
                full+=f'| Owner hierárquico | `{u["documentationParent"]}` — relação registrada no catálogo |\n'
            full+='\n## Situação registrada\n\n'
            full+='> '+safe_excerpt(status,460)+'\n\n'
            full+='A descrição acima é uma **citação resumida do STATUS versionado**; não significa que os testes de integração, a implantação ou a homologação estejam aprovados.\n\n'
            full+='## Matérias deste capítulo\n\n'
            full+='Cada matéria tem uma **página própria**, com conteúdo integral e referência ao arquivo fonte. Não é uma seção com âncora.\n\n'
            full+='| Matéria | Página de leitura | Arquivo canônico |\n|---|---|---|\n'
            for num,label,name in TOPICS:
                original=folder/'chapters'/name
                dest=BASE/volume/slug/(num+'-'+name.removeprefix(num+'-'))
                dest.parent.mkdir(parents=True,exist_ok=True)
                if original.is_file():
                    contents=source_markdown(original.read_text(encoding='utf-8'),original)
                    md=frontmatter(uid+' · '+label,f'Volume {AREAS[area][1]} · capítulo {uid} · matéria {num}')
                    md+=f'[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original]({gh(original)})\n\n'
                    md+='> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.\n\n'
                    md+=contents+'\n\n---\n'
                    md+=f'**Rastreabilidade:** [revisar documento fonte]({gh(original)}).\n'
                    dest.write_text(md,encoding='utf-8')
                    full+=f'| {num} — {label} | [Abrir matéria](./{dest.stem}/) | [Fonte]({gh(original)}) |\n'
                else:
                    full+=f'| {num} — {label} | Sem matéria versionada | **Lacuna** |\n'
            full+='\n## Referências operacionais e evolução\n\n'
            others=[('Plano e escopo',u.get('scope')),('Histórico',u.get('history')),('Evolução',u.get('evolution')),('Sprint',u.get('sprint'))]
            for label,p in others:
                if p and (ROOT/p).is_file():full+=f'- [{label}]({gh(ROOT/p)})\n'
            full+=f'- [Código no repositório](https://github.com/delmacy/syndes-system/tree/main/{u["source"]})\n'
            full+='\n---\n*Esta edição é experimental. A documentação canônica permanece em `docs/subprojects/`.*\n'
            chapter=BASE/volume/(slug+'.md')
            chapter.write_text(full,encoding='utf-8')
            chapter_index.append({'id':uid,'area':area,'source':str(source.relative_to(ROOT)),'page':str(chapter.relative_to(BASE)), 'topics':sum((folder/'chapters'/n).is_file() for _,_,n in TOPICS)})
    # Library home, clean volume hierarchy and progress based only on catalog.
    home=frontmatter('Biblioteca Syndes','Documentação organizada em volumes, capítulos e matérias técnicas')
    home+='# Biblioteca técnica do Syndes\n\nUma coleção de livros de engenharia, não um painel de features.\n\n'
    home+='> **Editor responsável:** os capítulos refletem os documentos versionados. A presença de uma ficha não comprova implementação integral ou operação homologada.\n\n'
    home+='## Volumes disponíveis\n\n'
    for area,(vol,name,tagline) in AREAS.items():
        n=len([u for u in CAT if u['front']==area])
        home+=f'### [{name}](./{vol}/)\n\n{tagline} **{n} capítulos**.\n\n'
    home+='## Como consultar\n\nEscolha um volume, abra a ficha do módulo e siga os hyperlinks das **oito matérias independentes**. Use as referências para confrontar cada afirmação com o código e o STATUS.\n\n'
    home+='**Nota editorial:** a ficha documenta o estado observado, não promete entrega funcional.\n'
    (BASE/'index.md').write_text(home,encoding='utf-8')
    (ROOT/'experiments/book-ab/starlight/chapters-manifest.json').write_text(json.dumps(chapter_index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'B edition enriched: {len(chapter_index)} chapters, {sum(c["topics"] for c in chapter_index)} separately rendered topic pages, {len(AREAS)} volumes')

if __name__=='__main__':enrich()
