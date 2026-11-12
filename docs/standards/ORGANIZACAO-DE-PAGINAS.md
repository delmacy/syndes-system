# Organização de páginas e subpastas

O Syndes Docs utiliza uma árvore de **área → módulo → página (Visão geral, Especificação, Referência técnica, Evolução, Histórico ou Operação)**. A árvore do portal é derivada diretamente de `catalog/work-units.json` pelo gerador `scripts/docs/build_site.py`. **Não** altera ownership, pacotes ou dependências.

## Separação física dos capítulos

- A documentação existente continua em `docs/subprojects/[ID]-[slug]/ESCOPO.md`, `STATUS.md`, `SPRINT.md`, `PROJECAO.md` e `IMPLEMENTACAO.md`. Os arquivos ESCOPO.md foram preservados como índice para manter a entrada e os links dos agentes; os conteúdos de seus tópicos foram transferidos para chapters/.
- As seções H2 dos escopos iniciais já foram migradas para arquivos independentes. Para os novos assuntos, pode-se criar `docs/subprojects/[ID]-[slug]/chapters/01-assunto.md`, `02-outro-assunto.md`, etc. O gerador encontra os arquivos e os incorpora ao corpo de **Especificação**, sem novos itens no menu.
- Cada capítulo novo deve ser uma fonte única; o ESCOPO deve indexar/linkar o capítulo, não duplicar sua especificação. Alterar ou retirar trechos aprovados exige decisão e revisão de consumidores.
- Cada cabeçalho Markdown H1–H4 é um tópico editável no portal. A solicitação mantém caminho do arquivo, cabeçalho, linha, SHA e conteúdo original para ser analisada no chat.

## Última alteração por tópico

O build calcula a data e o commit mais recentes das linhas pertencentes ao tópico, utilizando `git blame --line-porcelain`. O histórico completo do Git deve estar disponível (checkout `fetch-depth: 0`). Se não for possível verificar o histórico, a tela apresenta **não verificada** em vez de inventar uma data.

Uma subseção compõe o conteúdo de sua seção pai; por isso, uma alteração na subseção também atualiza a data da seção pai. Essa data é **data do commit que alterou o conteúdo**, não o momento da última leitura nem necessariamente o instante do deploy.

## Navegação com três níveis

1. **Área** — Produto, Plataforma, Frontend, Qualidade/Infraestrutura ou Operação.
2. **Módulo** — ID e nome da unidade no catálogo.
3. **Página** — Visão geral, Especificação, Referência técnica, Evolução, Histórico e Operação.

A página **Escopo** agrega automaticamente o conteúdo dos capítulos Markdown do módulo no **corpo da documentação**, com sumário de títulos e diagramas Mermaid. Os capítulos permanecem arquivos independentes em chapters/, para edição por tópico, histórico e acesso dos agentes ao caminho exato. Esses caminhos não aparecem como novos níveis na navegação lateral.

O editor contextual identifica a origem correta de cada trecho do escopo agregado. A proposta fica vinculada ao Markdown de capítulo, não ao arquivo índice ESCOPO.md.

## Diagramas como parte da especificação

- Usar blocos Mermaid versionados (`flowchart`, `sequenceDiagram` ou `stateDiagram-v2`) **no corpo do capítulo Markdown do módulo**, sem adicionar níveis no sidebar.
- Manter o diagrama próximo do contrato ou fluxo a que se refere, sempre citando o caminho do código, ADR ou WBS.
- Indicar explicitamente fluxos **em operação**, **implementados apenas em código**, **opt-in** ou **planejados**. Linha tracejada pode sinalizar dependência condicionada, mas a legenda textual é obrigatória.
- Evitar informações confidenciais, instâncias reais, tokens, topologias sensíveis e URLs internas em repositório público.
- Quando a especificação mudar, atualizar o diagrama no mesmo PR e revalidar com `python -m unittest discover -s scripts/docs -p 'test_*.py'` e o build MkDocs.
- Nos módulos ainda não auditados, não criar diagramas inventados: primeiro verificar fonte e contratos públicos, depois completar o capítulo de arquitetura.

## Leitura ampla e índice integrado

A navegação permanece **Área → Módulo → Página**. A página opcional **Referência técnica** reúne stack, métodos, contratos, frontend e schemas. Com `toc.integrate`, os subtítulos de cada página aparecem na navegação lateral esquerda; não há coluna permanente de índice à direita. O conteúdo utiliza largura fluida em telas grandes, com limite de legibilidade e adaptação responsiva. `navigation.indexes` deve permanecer desativado enquanto `toc.integrate` estiver ativo (incompatibilidade documentada do Material).


## Modelo documental de seis páginas

Cada unidade tem seis entradas na navegação Área → Módulo → Página:

- **Visão geral:** ID, proprietário, fontes e catálogo de navegação.
- **Especificação:** ESCOPO.md e seus capítulos; documentação normativa e diagramas.
- **Referência técnica:** stack, classes, interfaces públicas, frontend e SQL (fontes verificáveis).
- **Evolução:** workpackages e tasks da WBS com links para Issues/Projects, sem copiar status concorrentes.
- **Histórico:** linha do tempo gerada de commits do código e docs + links explícitos do índice de rastreabilidade.
- **Operação:** STATUS.md, SPRINT.md, runbooks, monitoramento e prompts, preservando os caminhos canônicos antigos.

**Não** exibir os prompts nem STATUS/SPRINT como novos níveis. O índice de tópicos continua integrado na árvore esquerda, dentro da página em uso.

## Componentes de um módulo não viram novos módulos no menu

Unidades do catálogo que representam um **componente interno** de outra unidade podem declarar `documentationParent`. Permanecem no catálogo e com seus caminhos de fonte, testes, WBS, histórico e prompts, mas não geram entrada própria na navegação principal.

Exemplo real: **I09 Whatsmeow Runtime → P03 WhatsApp**. O runtime é um sidecar Go de protocolo; o plugin NestJS e o domínio de WhatsApp são componentes do P03. Suas documentações históricas seguem com URL estável; novos assuntos ficam nas páginas Referência técnica, Evolução e Operação do P03.

A hierarquia pública continua **Área → Módulo → Página**, sem quarto nível. Essa relação não reatribui automaticamente tarefas, muda ownership do código nem autoriza deploy. **Não** agrupar módulos de negócio numa área artificial chamada "Plugins": plugin é um mecanismo técnico de composição.
