#!/usr/bin/env python3
"""Render each Syndes module as ONE continuous Starlight page with anchored topics.

This transforms only the experimental reader. Canonical Markdown is never edited.
Every section has a direct GitHub-edit link to its source and an adjustment template.
"""
import json
import re
import shutil
from pathlib import Path
from enrich_starlight_book import (
    ROOT, BASE, CAT, AREAS, SUBCHAPTERS, TOPICS,
    gh, yml, frontmatter, source_markdown, relevant_source_lines,
)

EDIT_PREFIX='https://github.com/delmacy/syndes-system/edit/main/'


def edit_link(path):
    return EDIT_PREFIX+path.relative_to(ROOT).as_posix()


def section_of_heading(title):
    options=[
        ('apis',r'http|api|endpoint|rotas?'),
        ('schema',r'sql|schema|migration|tabela|banco'),
        ('eventos',r'evento|outbox|mensager|consumer'),
        ('contratos',r'contrato|classe|m[eé]todo|s[ií]mbolo|exports?'),
        ('interface',r'frontend|interface|workspace|tela'),
        ('testes',r'teste|evid[eê]ncia|valida[cç]|gate'),
        ('dependencias',r'stack|depend[eê]ncia|fronteira|integra[cç]'),
        ('configuracao',r'configura[cç]|ambiente|secret'),
        ('dados',r'dados|persist[eê]ncia|reposit[oó]rio'),
        ('operacao',r'opera[cç]|runbook|implanta'),
        ('requisitos',r'requisito|capability|responsabil'),
    ]
    return next((key for key,pat in options if re.search(pat,title.lower())), 'arquitetura')


def complete_heading_blocks(text):
    """Partition a source at second-level headings; preserve all Markdown bytes."""
    lines=text.splitlines(keepends=True)
    result=[]; begin=0; heading=''; fence=None
    for index,line in enumerate(lines):
        match=re.match(r'^\s*('+chr(96)+r'{3,}|~{3,})',line)
        if match:
            mark=match.group(1)
            if fence is None: fence=mark
            elif mark[0]==fence[0] and len(mark)>=len(fence): fence=None
            continue
        if fence: continue
        match=re.match(r'^##\s+(.+?)\s*$',line)
        if match:
            if index>begin: result.append((heading,''.join(lines[begin:index])))
            begin=index;heading=match.group(1)
    if begin<len(lines): result.append((heading,''.join(lines[begin:])))
    assert ''.join(chunk for _,chunk in result)==text
    return result


TOPIC_TO_SECTION={'00':'configuracao','01':'requisitos','02':'casos-de-uso',
    '03':'requisitos','04':'contratos','05':'arquitetura','06':'wbs','07':'wbs'}
EDIT_PREFIX='https://github.com/delmacy/syndes-system/edit/main/'


def render():
    if len(CAT)!=57 or len({u['id'] for u in CAT})!=57:
        raise ValueError('Unexpected module catalog')
    headings=[('estado','Estado e escopo'),('casos-de-uso','Casos de uso'),
        ('historias-de-usuario','Histórias de usuário'),('requisitos','Requisitos e capacidades'),
        ('arquitetura','Arquitetura e implementação'),('contratos','Contratos públicos e privados'),
        ('apis','APIs e endpoints'),('eventos','Eventos e mensageria'),
        ('dados','Dados e persistência'),('schema','Schemas e migrations'),
        ('dependencias','Dependências e integrações'),
        ('configuracao','Configuração e ambiente'),('interface','Frontend e interfaces'),
        ('testes','Testes e evidências'),('operacao','Operação e implantação'),
        ('wbs','WBS e evolução')]
    manifest=[]
    for u in CAT:
        uid=u['id']; volume=AREAS[u['front']][0]; root=(ROOT/u['entry']).parent
        status=ROOT/u['status']; tech=ROOT/u['technicalReference']; op=ROOT/u['operation']
        sections={key:[] for key,_ in headings}
        for key,path in [('estado',status),('operacao',op)]:
            if path.is_file(): sections[key].append((path,path.read_text(encoding='utf-8')))
        if tech.is_file():
            for heading,content in complete_heading_blocks(tech.read_text(encoding='utf-8')):
                sections[section_of_heading(heading)].append((tech,content))
        for num,label,name in TOPICS:
            source=root/'chapters'/name
            if source.is_file():
                sections[TOPIC_TO_SECTION[num]].append((source,source.read_text(encoding='utf-8')))
        body=frontmatter(uid+' — '+u['name'],'Markdown contínuo, integral e versionado')
        body+='# '+uid+' — '+u['name']+'\n\n'
        body+='[← Volume](../) · [↑ Biblioteca](../../)\n\n'
        body+='> Conteúdo integral dos arquivos versionados. Código documentado não significa homologação.\n\n'
        body+='**Código:** '+u['source']+' · [STATUS]('+gh(status)+') · [Referência técnica]('+gh(tech)+') · [Operação]('+gh(op)+')\n\n'
        body+='## Índice do módulo\n\n'
        for key,label in headings: body+='- ['+label+'](#'+key+')\n'
        body+='- [Registro de alterações](#registro-de-alteracoes)\n\n'
        counts={}
        for key,label in headings:
            body+='\n<a id="'+key+'"></a>\n\n## '+label+'\n\n'
            blocks=sections[key]; counts[key]=len(blocks)
            if not blocks:
                body+='**Lacuna documental:** não há conteúdo canônico específico para esta área. Nenhuma funcionalidade é presumida.\n\n'
                body+='[Editar referência técnica]('+EDIT_PREFIX+tech.relative_to(ROOT).as_posix()+')\n\n'
            for source,full_text in blocks:
                rel=source.relative_to(ROOT).as_posix()
                body+='**Fonte completa:** ['+rel+']('+gh(source)+') · [Editar conteúdo]('+EDIT_PREFIX+rel+')\n\n'
                content=source_markdown(full_text,source)
                content=re.sub(r'^(#{1,6})(\s+)',lambda match:'#'*min(6,len(match.group(1))+3)+match.group(2),content,flags=re.M)
                body+=content.rstrip()+'\n\n'
            body+='<details>\n<summary>Espaço para alterações</summary>\n\n'
            body+='Edite o arquivo-fonte pelo link acima, registrando implementação, testes, evidências, pendências e aceite. O Pages é somente leitura.\n\n</details>\n\n'
        body+='<a id="registro-de-alteracoes"></a>\n\n## Registro de alterações\n\n'
        body+='Os arquivos Markdown canônicos recebem alterações versionadas no GitHub. Esta página é recomposta no próximo build.\n\n'
        body+='[Editar STATUS]('+EDIT_PREFIX+status.relative_to(ROOT).as_posix()+') · [Editar referência técnica]('+EDIT_PREFIX+tech.relative_to(ROOT).as_posix()+') · [Editar operação]('+EDIT_PREFIX+op.relative_to(ROOT).as_posix()+')\n\n'
        body+='*A documentação canônica permanece em docs/subprojects. Nenhum STATUS parcial equivale a homologação.*\n'
        page=BASE/volume/(uid.lower()+'.md')
        page.parent.mkdir(parents=True,exist_ok=True)
        page.write_text(body,encoding='utf-8')
        obsolete=BASE/volume/uid.lower()
        if obsolete.exists():shutil.rmtree(obsolete)
        manifest.append({'id':uid,'area':u['front'],'page':str(page.relative_to(BASE)),'sections':counts})
    (ROOT/'experiments/book-ab/starlight/chapters-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    groups=[]
    for area,(volume,title,_) in AREAS.items():
        entries=[{'slug':volume}]
        entries.extend({'slug':volume+'/'+u['id'].lower()} for u in CAT if u['front']==area)
        groups.append({'label':title,'collapsed':area!='produto','items':entries})
    config='import { defineConfig } from "astro/config";\nimport starlight from "@astrojs/starlight";\n'
    config+='export default defineConfig({site:"https://delmacy.github.io",base:"/syndes-system/assets/experimentos/livros/b",integrations:[starlight({title:"Syndes · Biblioteca B",description:"Acervo técnico do Syndes",locales:{root:{label:"Português",lang:"pt-BR"}},sidebar:'
    config+=json.dumps(groups,ensure_ascii=False)+',tableOfContents:{minHeadingLevel:2,maxHeadingLevel:2},customCss:["./src/styles/custom.css"]})]});\n'
    (ROOT/'experiments/book-ab/starlight/astro.config.mjs').write_text(config,encoding='utf-8')
    print('Composed full Markdown for',len(manifest),'modules')

if __name__=='__main__':render()
