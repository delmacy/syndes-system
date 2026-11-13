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


def append_section(key,heading,patterns,source_paths):
    """Keep the evidence text and an unmistakable section-edit affordance."""
    primary=next((p for p in source_paths if p.is_file()),None)
    result=f'\n<a id="{key}"></a>\n\n## {heading}\n\n'
    if primary:
        result+=f'**Editar esta seção:** [Abrir arquivo-fonte no GitHub]({edit_link(primary)}) · [Consultar fonte]({gh(primary)})\n\n'
    result+='*Referências extraídas da documentação versionada, sem inferir homologação ou implantação.*\n\n'
    found=0
    for src in source_paths:
        if not src.is_file():continue
        matches=relevant_source_lines(src,patterns)
        if not matches:continue
        found+=len(matches)
        result+=f'**Fonte:** [{src.name}]({gh(src)})\n\n'
        for n,line in matches:
            result+=f'> Linha {n}: {line.replace(chr(124),chr(92)+chr(124))}\n\n'
    if not found:
        result+='**Lacuna documental:** ainda não há especificação textual identificada nesta área. Revisar implementação e registrar evidência antes de preencher.\n\n'
    result+='''<details>
<summary>📝 Espaço para ajustes e implementação</summary>

Este é um **modelo de registro**, não um editor com salvamento automático. Use o link **Editar esta seção** para atualizar o documento versionado.

- **Alteração proposta:** descreva o requisito, contrato, dado ou comportamento.
- **Referência de código:** informe caminho e símbolo real.
- **Testes e evidências:** informe comando, resultado e limite.
- **Critério de aceite:** indique como validar sem presumir homologação.
- **Status e revisão:** atualize a fonte canônica após revisão.

</details>

'''
    return result,found


def render():
    if len(CAT)!=57:raise ValueError('Unexpected canonical catalog count')
    manifest_path=ROOT/'experiments/book-ab/starlight/chapters-manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    refs={x['id']:x for x in manifest}
    for u in CAT:
        uid=u['id'];vol=AREAS[u['front']][0];code=uid.lower()
        folder=(ROOT/u['entry']).parent
        status=ROOT/u['status'];tech=ROOT/u['technicalReference'];op=ROOT/u['operation']
        module=BASE/vol/(code+'.md')
        original=module.read_text(encoding='utf-8')
        before=original.split('## Matérias deste capítulo',1)[0].split('## Índice dos subcapítulos',1)[0]
        if not before.startswith('---\n'):
            raise ValueError('Missing Starlight frontmatter in '+uid)
        # Remove old links to pages that will disappear and keep module metadata/status.
        book=before
        book+='## Índice dos subcapítulos\n\n'
        book+='Todos os assuntos deste módulo estão nesta página. Clique em um título para saltar à seção correspondente; o índice lateral acompanha a leitura.\n\n'
        for key,label,_,_ in SUBCHAPTERS:
            book+=f'- [{label}](#{key})\n'
        book+='- [Documentação de origem integral](#documentacao-de-origem)\n'
        book+='- [Controle de alterações](#controle-de-alteracoes)\n\n'
        counts={}
        for key,label,patterns,nums in SUBCHAPTERS:
            topics=[folder/'chapters'/filename for num,_,filename in TOPICS if num in nums]
            if key in ('casos-de-uso','historias-de-usuario','requisitos'):
                sources=[*topics,tech,status,op]
            elif key in ('operacao','configuracao'):
                sources=[op,tech,*topics,status]
            elif key in ('testes','wbs'):
                sources=[status,*topics,tech,op]
            else:
                sources=[tech,*topics,status,op]
            sources=list(dict.fromkeys(sources))
            text,n=append_section(key,label,patterns,sources)
            book+=text
            counts[key]=n
        book+='\n<a id="documentacao-de-origem"></a>\n\n## Documentação de origem integral\n\n'
        book+='Os oito assuntos canônicos são reproduzidos abaixo para permitir leitura contínua. As fontes versionadas permanecem editáveis e preservadas.\n\n'
        for num,label,filename in TOPICS:
            source=folder/'chapters'/filename
            book+=f'### {num} · {label}\n\n'
            if not source.is_file():
                book+='**Lacuna:** arquivo de origem não encontrado.\n\n'
                continue
            book+=f'[Editar conteúdo original]({edit_link(source)}) · [Abrir fonte]({gh(source)})\n\n'
            content=source_markdown(source.read_text(encoding='utf-8'),source)
            # Shift original headings under each appendix heading without changing prose.
            content=re.sub(r'^(#{1,6})(\s+)',lambda m:'#'*min(6,len(m.group(1))+3)+m.group(2),content,flags=re.M)
            book+=content.rstrip()+'\n\n'
        book+='\n<a id="controle-de-alteracoes"></a>\n\n## Controle de alterações\n\n'
        book+='**Este site é somente leitura.** Para alterar qualquer seção, edite o documento canônico no GitHub; a próxima publicação atualizará este livro automaticamente.\n\n'
        book+='| Registro | Onde editar |\n|---|---|\n'
        book+=f'| Especificação e referências | [Referência técnica]({edit_link(tech)}) |\n'
        book+=f'| Estado real e bloqueios | [STATUS]({edit_link(status)}) |\n'
        book+=f'| Procedimentos e implantação | [Operação]({edit_link(op)}) |\n'
        book+=f'| Capítulos canônicos | [Página do módulo]({gh(ROOT/u["entry"])}) |\n\n'
        book+='**Registro recomendado:** data e responsável; alteração; contrato ou interface afetada; testes; impacto em dependências; evidência; revisão/aceite.\n\n'
        book+='---\n*Leitura experimental Starlight; a documentação canônica permanece em `docs/subprojects/`. Não inferir entrega funcional a partir de documentação presente.*\n'
        module.write_text(book,encoding='utf-8')
        refs[uid]['subchapters']=counts
        # Remove the previously split topic/subchapter page sources.
        derived=BASE/vol/code
        if derived.exists():shutil.rmtree(derived)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Modules in sidebar, topic anchors in Starlight's right-hand TOC.
    groups=[]
    for area,(vol,title,_) in AREAS.items():
        entries=[{'slug':vol}]
        entries.extend({'slug':vol+'/'+u['id'].lower()} for u in CAT if u['front']==area)
        groups.append({'label':title,'collapsed':area!='produto','items':entries})
    config='import { defineConfig } from "astro/config";\nimport starlight from "@astrojs/starlight";\n'
    config+='export default defineConfig({site:"https://delmacy.github.io",base:"/syndes-system/assets/experimentos/livros/b",integrations:[starlight({title:"Syndes · Biblioteca B",description:"Acervo técnico do Syndes",locales:{root:{label:"Português",lang:"pt-BR"}},sidebar:'
    config+=json.dumps(groups,ensure_ascii=False)
    config+=',tableOfContents:{minHeadingLevel:2,maxHeadingLevel:2},customCss:["./src/styles/custom.css"]})]});\n'
    (ROOT/'experiments/book-ab/starlight/astro.config.mjs').write_text(config,encoding='utf-8')
    print('Starlight continuous edition: 57 module documents, 14 anchored sections each, original topics appended')

if __name__=='__main__':render()
