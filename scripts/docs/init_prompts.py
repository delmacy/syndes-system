from pathlib import Path
import json
r=Path('/home/delmacy/syndes-worktrees/reconcile-local-20261111')
units=json.loads((r/'docs/subprojects/index.json').read_text())['units']
for u in units:
 d=r/Path(u['entry']).parent
 for filename,mode in [('PROJECAO.md','PROJEÇÃO'),('IMPLEMENTACAO.md','IMPLEMENTAÇÃO')]:
  p=d/filename
  if p.exists(): continue
  common=f'''# SYNDES — PROMPT DE {mode} · {u["id"]} {u["name"]}

> Copie este texto para um chat especializado. Os caminhos são relativos à raiz do repositório `delmacy/syndes-system`.

**Unidade autorizada:** `{u["id"]}` — {u["name"]}
**Área:** `{u["front"]}`
**Escopo:** `{u["scope"]}`
**Status:** `{u["status"]}`
**Sprint:** `{u["sprint"]}`
**Artefatos próprios:** `{u["source"]}`
**Catálogo de contratos públicos:** `docs/standards/CONTRATOS-PUBLICOS.md`
**Regras globais obrigatórias:** `AGENTS.md`
**Tópico / requisito solicitado:** [INSERIR ID, SEÇÃO OU ÂNCORA DO TÓPICO]

**Ordem de leitura:** escopo e tópico indicado → status/sprint → código próprio e regras locais pertinentes → apenas contratos públicos externos indispensáveis. Não ler todo o Blueprint automaticamente.

**Limite:** atuar exclusivamente em {u["id"]}. É permitido consultar documentação de contratos públicos e imports exportados de outras unidades. É proibido assumir responsabilidade por desenho interno ou modificar outra unidade. Se houver impacto externo, registrar o contrato, a unidade proprietária e o bloqueio. Não especular sobre a arquitetura privada alheia.
'''
  if filename=='PROJECAO.md':
   body='''\n## Atuação e saída\nAtue como analista de requisitos e arquiteto desta unidade, sem executar código. Discuta apenas funcionalidades, arquitetura interna e integrações públicas desta unidade. Separe fato comprovado de hipótese, identifique riscos, perguntas essenciais e critérios de aceite. Não expandir o MVP automaticamente. Produza proposta de alteração textual, com IDs afetados, para minha aprovação.\n\nNão altere outros arquivos nem escopo normativo sem autorização explícita.\n'''
  else:
   body='''\n## Atuação e saída\nAtue como engenheiro desta unidade. Antes de editar, confira worktree/branch, SHA e alterações alheias, os requisitos aprovados e contratos públicos importados. Use bibliotecas já exportadas antes de propor uma nova. Consulte as instruções de implementação e segurança de `AGENTS.md` e do módulo local.\n\nImplemente exclusivamente o incremento aprovado nesta unidade. Execute testes unitários, contratos, integração e segurança afetados; confira evidências de GitHub Actions sem assumir CI verde. Não altere CI/CD de outra equipe, banco operacional, migrações reais, papéis ou deploy sem gates pertinentes. Ao encerrar a meta, atualize STATUS e SPRINT com evidências, bloqueios e próxima tarefa, e **pare** antes de iniciar outra sprint.\n\nVariáveis: documente nomes reais, origem e modo de injeção, jamais valores secretos. Se um requisito depender de mudança interna externa, informe o impedimento e não implemente fora de sua unidade.\n'''
  p.write_text(common+body)
print('Prompts especializados:',len(list((r/'docs/subprojects').glob('*/PROJECAO.md'))),len(list((r/'docs/subprojects').glob('*/IMPLEMENTACAO.md'))))
