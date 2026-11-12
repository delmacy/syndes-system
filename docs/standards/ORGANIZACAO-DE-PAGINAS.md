# Organização de páginas e subpastas

O Syndes Docs utiliza uma árvore de **área → subárea → unidade → tipo de documentação → capítulo**. A árvore é definida em `scripts/docs/navigation.json`, validada contra `catalog/work-units.json`. **Não** altera ownership, pacotes ou dependências.

## Separação física dos capítulos

- A documentação existente continua em `docs/subprojects/[ID]-[slug]/ESCOPO.md`, `STATUS.md`, `SPRINT.md`, `PROJECAO.md` e `IMPLEMENTACAO.md`. Não mover arquivos em massa por estética, pois agentes e links já dependem desses caminhos.
- Quando um escopo crescer, pode-se criar `docs/subprojects/[ID]-[slug]/chapters/01-assunto.md`, `02-outro-assunto.md`, etc. O gerador encontra esses arquivos automaticamente e cria subpáginas de **Especificação** no menu.
- Cada capítulo novo deve ser uma fonte única; o ESCOPO deve indexar/linkar o capítulo, não duplicar sua especificação. Alterar ou retirar trechos aprovados exige decisão e revisão de consumidores.
- Cada cabeçalho Markdown H1–H4 é um tópico editável no portal. A solicitação mantém caminho do arquivo, cabeçalho, linha, SHA e conteúdo original para ser analisada no chat.

## Última alteração por tópico

O build calcula a data e o commit mais recentes das linhas pertencentes ao tópico, utilizando `git blame --line-porcelain`. O histórico completo do Git deve estar disponível (checkout `fetch-depth: 0`). Se não for possível verificar o histórico, a tela apresenta **não verificada** em vez de inventar uma data.

Uma subseção compõe o conteúdo de sua seção pai; por isso, uma alteração na subseção também atualiza a data da seção pai. Essa data é **data do commit que alterou o conteúdo**, não o momento da última leitura nem necessariamente o instante do deploy.
