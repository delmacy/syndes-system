#!/usr/bin/env python3
"""Generate two isolated documentation book prototypes from the same tracked source.
No product or Pages configuration is changed by this script.
"""
import json, re, shutil, html
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
CAT=json.loads((ROOT/'docs/subprojects/index.json').read_text())['units']
DEST=ROOT/'experiments/book-ab'
AREA={'produto':('01-produto','Produto e módulos de negócio'),'plataforma':('02-plataforma','Plataforma e core'),'frontend':('03-interfaces','Interfaces e aplicações'),'operacao':('04-operacao','Operação e negócios'),'qualidade':('05-infra-qualidade','Infraestrutura e qualidade')}
TOPICS=[('Missão e limites','01-missao-objetivos-e-fronteiras.md'),('Requisitos e casos de uso','02-requisitos-historias-e-casos-de-uso.md'),('Capacidades','03-capabilities.md'),('Contratos públicos e dependências','04-contratos-e-dependencias-publicas.md'),('Arquitetura, SQL, APIs e interface','05-arquitetura-banco-interface-configuracao-e-diagramas.md'),('WBS e aceitação','06-wbs-marcos-e-aceite.md'),('Controle de escopo','07-controle-do-escopo.md')]
DOCS_HEAD=ROOT/'docs'
def src_link(p):return 'https://github.com/delmacy/syndes-system/blob/main/'+p.relative_to(ROOT).as_posix()
def excerpt(path,n=650):
 if not path.is_file():return '*Não há conteúdo documental nessa ficha.*'
 raw=path.read_text(errors='replace')
 raw=re.sub(r'^#+ .*$','',raw,flags=re.M)
 raw=re.sub(r'\[[^\]]+\]\([^)]*\)', '',raw)
 raw=re.sub(r'^\s*[-*] \[[ xX]\] ', '- ',raw,flags=re.M)
 raw=re.sub(r'\s+',' ',raw).strip()
 return html.escape(raw[:n]).replace('&lt;','<').replace('&gt;','>')+' …' if len(raw)>n else html.escape(raw)

def frontmatter_escape(s):return json.dumps(s,ensure_ascii=False)
def unit_md(u,kind):
 sid, title=u['id'],u['name']; dir=(ROOT/u['entry']).parent; slug=f'{AREA[u["front"]][0]}/{sid.lower()}'
 status=ROOT/u['status']; ref=ROOT/u['technicalReference']; op=ROOT/u['operation'];source=u['source']
 parts=[]
 if kind=='B':parts.extend(['---',f'title: {frontmatter_escape(sid+" — "+title)}',f'description: {frontmatter_escape("Capítulo "+sid+" do volume "+AREA[u["front"]][1])}', 'draft: false', '---',''])
 else:parts.append('# '+sid+' — '+title+'\n')
 parts+= [f'**Volume:** {AREA[u["front"]][1]} · **Capítulo:** {sid} · **Fonte catalogada:** `{source}`','', '> **Protótipo editorial:** os trechos seguintes são derivados dos arquivos versionados; existência de código não significa homologação.','', '## Ficha uniforme do capítulo','', '| Campo | Referência |','|---|---|',f'| Código e owner | `{sid}` · `{source}` |',f'| Estado declarado | [STATUS no repositório]({src_link(status)}) |',f'| Contratos, classes e APIs | [Referência técnica]({src_link(ref)}) |',f'| Implantação e operação | [Operação]({src_link(op)}) |','', '## 1. Estado documentado','',excerpt(status,950),'', '## 2. Contratos, APIs, métodos e dados','',excerpt(ref,1250),'', '## 3. Operação e evidências','',excerpt(op,950),'', '## 4. Seções de referência','']
 for label,name in TOPICS:
  p=dir/'chapters'/name
  if p.is_file(): parts.append(f'- [{label}]({src_link(p)})')
 parts +=['','## 5. Fontes cruzadas','', f'- [Módulo no catálogo]({src_link(ROOT/u["entry"])})', f'- [Código de origem no GitHub](https://github.com/delmacy/syndes-system/tree/main/{source})','', '---','*Ficha gerada para comparação A/B; não substitui os documentos canônicos.*']
 return '\n'.join(parts)+'\n'

def build():
 if DEST.exists():shutil.rmtree(DEST)
 a=DEST/'vitepress'; b=DEST/'starlight';(a/'docs').mkdir(parents=True); (b/'src/content/docs').mkdir(parents=True)
 grouping={key:[] for key in AREA}
 for u in CAT:
  grouping[u['front']].append(u)
  slug=f'{AREA[u["front"]][0]}/{u["id"].lower()}.md'
  for root,kind in [(a/'docs','A'),(b/'src/content/docs','B')]:
   dest=root/slug;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(unit_md(u,kind))
 intro=['# Biblioteca Syndes','', 'Documentação técnica organizada como coleção de livros. Cada **assunto é um volume**; cada **módulo é um capítulo** com ficha padronizada.','', '> A/B experimental — fontes catalogadas, nenhum status de entrega funcional inferido.','']
 for front,(slug,name) in AREA.items():
  intro+=['## '+name,'']
  for u in grouping[front]:intro.append(f'- [{u["id"]} — {u["name"]}](./{slug}/{u["id"].lower()})')
  intro.append('')
 (a/'docs/index.md').write_text('\n'.join(intro).replace(']( /','](/'))
 (b/'src/content/docs/index.md').write_text('---\ntitle: Biblioteca Syndes\ndescription: Experiência B de coleção de volumes e capítulos\ndraft: false\n---\n\n'+ '\n'.join(intro[1:]))
 # Config references generated from canonical catalog only.
 lists=[]
 for front,(slug,name) in AREA.items():
  items=[{'text':u['id']+' · '+u['name'],'link':'/'+slug+'/'+u['id'].lower()} for u in grouping[front]]
  lists.append({'text':name,'collapsed':front!='produto','items':items})
 vite={'lang':'pt-BR','base':'/syndes-system/assets/experimentos/livros/a/','title':'Syndes · Biblioteca A','description':'Acervo técnico do Syndes','themeConfig':{'nav':[{'text':'Biblioteca','link':'/'},{'text':'Volumes','items':[{'text':x['text'],'link':x['items'][0]['link']} for x in lists]}], 'sidebar':lists,'outline':{'level':[2,3],'label':'Nesta ficha'},'docFooter':{'prev':'Capítulo anterior','next':'Próximo capítulo'},'search':{'provider':'local'},'socialLinks':[],'footer':{'message':'Experimento A · VitePress','copyright':'Fontes técnicas versionadas'}}}
 (a/'docs/.vitepress').mkdir(parents=True)
 (a/'docs/.vitepress/config.mjs').write_text('import { defineConfig } from "vitepress";\nexport default defineConfig('+json.dumps(vite,ensure_ascii=False,indent=2)+');\n')
 (a/'package.json').write_text(json.dumps({'private':True,'type':'module','scripts':{'build':'vitepress build docs'},'dependencies':{'vitepress':'^1.6.4'}},indent=2))
 # Astro's sidebar autogeneration preserves all 57 chapter links.
 sidebar=[{'label':name,'collapsed':front!='produto','items':[{'slug':slug+'/'+u['id'].lower()} for u in grouping[front]]} for front,(slug,name) in AREA.items()]
 (b/'astro.config.mjs').write_text('import { defineConfig } from "astro/config";\nimport starlight from "@astrojs/starlight";\nexport default defineConfig({site:"https://delmacy.github.io",base:"/syndes-system/assets/experimentos/livros/b",integrations:[starlight({title:"Syndes · Biblioteca B", description:"Acervo técnico do Syndes", locales:{root:{label:"Português",lang:"pt-BR"}}, sidebar:'+json.dumps(sidebar,ensure_ascii=False)+',tableOfContents:{minHeadingLevel:2,maxHeadingLevel:3},customCss:["./src/styles/custom.css"]})]});\n')
 (b/'src/content.config.ts').write_text('import { defineCollection } from "astro:content";\nimport { docsLoader } from "@astrojs/starlight/loaders";\nimport { docsSchema } from "@astrojs/starlight/schema";\nexport const collections = { docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }) };\n')
 (b/'src/styles').mkdir(parents=True)
 (b/'src/styles/custom.css').write_text(':root { --sl-color-accent-low: #142d36; --sl-color-accent: #0c8b9c; --sl-color-accent-high: #c8f5f5; }\n')
 (b/'package.json').write_text(json.dumps({'private':True,'type':'module','scripts':{'build':'astro build'},'dependencies':{'astro':'^5.15.0','@astrojs/starlight':'^0.36.0'}},indent=2))
 (DEST/'README.md').write_text('# Syndes · Prototipação A/B de biblioteca\n\nA = VitePress, B = Astro Starlight. Mesma fonte para 57 capítulos em cinco volumes. Snapshot para avaliação da interface, não da completude técnica.\n\nA execução `python3 scripts/docs/build_book_ab.py` gera dois projetos temporários. Para produzir os bundles HTML, execute `npm install` + `npm run build` em cada projeto e copie `vitepress/docs/.vitepress/dist` e `starlight/dist` para caminhos de prévia isolados. Não substituir MkDocs sem decisão explícita.\n')
 print('Generated',len(CAT),'chapters in both frameworks')
if __name__=='__main__':build()
