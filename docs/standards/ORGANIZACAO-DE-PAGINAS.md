# Organização de páginas e subpastas

O Syndes Docs utiliza **dois eixos de consulta**: **camada técnica** (domínio, dados, interfaces, contratos, APIs, dependências, operação e qualidade) e **módulo proprietário** (área → ficha do módulo). As seis páginas detalhadas de cada unidade continuam acessíveis pela ficha, sem repetição no menu lateral. A árvore é derivada de `catalog/work-units.json` por `scripts/docs/build_site.py` e **não** altera ownership, pacotes ou dependências.

A navegação principal contém **sete grupos**: Início, Projetos, Documentação, Módulos por área, APIs e dados, Operações, Guias e colaboração. As seções são expansíveis para reduzir o ruído visual. O catálogo continua com **49 módulos principais** agrupados por domínio funcional; entradas internas vinculadas a `documentationParent` permanecem pesquisáveis sem duplicar menus. A Home oferece quatro cards de acesso, seguidos por um índice de assuntos. Os índices de APIs, dados, roadmap e ambientes são páginas de encaminhamento para fontes existentes, não novos serviços ou status de execução.

## Separação física dos capítulos

- A documentação existente continua em `docs/subprojects/[ID]-[slug]/ESCOPO.md`, `STATUS.md`, `SPRINT.md`, `PROJECAO.md` e `IMPLEMENTACAO.md`. Os arquivos ESCOPO.md foram preservados como índice para manter a entrada e os links dos agentes; os conteúdos de seus tópicos foram transferidos para chapters/.
- As seções H2 dos escopos iniciais já foram migradas para arquivos independentes. Para os novos assuntos, pode-se criar `docs/subprojects/[ID]-[slug]/chapters/01-assunto.md`, `02-outro-assunto.md`, etc. O gerador encontra os arquivos e os incorpora ao corpo de **Especificação**, sem novos itens no menu.
- Cada capítulo novo deve ser uma fonte única; o ESCOPO deve indexar/linkar o capítulo, não duplicar sua especificação. Alterar ou retirar trechos aprovados exige decisão e revisão de consumidores.
- Cada cabeçalho Markdown H1–H4 é um tópico editável no portal. A solicitação mantém caminho do arquivo, cabeçalho, linha, SHA e conteúdo original para ser analisada no chat.

## Última alteração por tópico

O build calcula a data e o commit mais recentes das linhas pertencentes ao tópico, utilizando `git blame --line-porcelain`. O histórico completo do Git deve estar disponível (checkout `fetch-depth: 0`). Se não for possível verificar o histórico, a tela apresenta **não verificada** em vez de inventar uma data.

Uma subseção compõe o conteúdo de sua seção pai; por isso, uma alteração na subseção também atualiza a data da seção pai. Essa data é **data do commit que alterou o conteúdo**, não o momento da última leitura nem necessariamente o instante do deploy.

## Navegação por duas dimensões

1. **Camada técnica** — o [mapa de camadas](../blueprint/MAPA-TECNICO-POR-CAMADAS.md) mostra o tipo de evidência e suas limitações.
2. **Módulo responsável** — o [catálogo filtrável](../blueprint/CATALOGO-MODULOS.md) encontra o ID, os símbolos e o caminho de origem; a navegação lateral mantém apenas **área → ficha do módulo**, sem uma árvore de seis subitens.
3. **Detalhe da unidade** — a ficha tem links para Especificação, Referência técnica, Evolução, Histórico, Operação e prompts. Os caminhos e IDs persistem para agentes e links antigos.

A página **Escopo** agrega automaticamente capítulos Markdown no corpo da documentação, com sumário de títulos e diagramas Mermaid. Os capítulos permanecem independentes em `chapters/`, para edição por tópico, histórico e leitura dos agentes; não aparecem como novos níveis da barra lateral.

O editor contextual identifica a origem de cada trecho do escopo agregado e mantém a proposta vinculada ao Markdown de capítulo, não ao índice `ESCOPO.md`.

## Diagramas como parte da especificação

- Usar blocos Mermaid versionados (`flowchart`, `sequenceDiagram` ou `stateDiagram-v2`) **no corpo do capítulo Markdown do módulo**, sem adicionar níveis no sidebar.
- Manter o diagrama próximo do contrato ou fluxo a que se refere, sempre citando o caminho do código, ADR ou WBS.
- Indicar explicitamente fluxos **em operação**, **implementados apenas em código**, **opt-in** ou **planejados**. Linha tracejada pode sinalizar dependência condicionada, mas a legenda textual é obrigatória.
- Evitar informações confidenciais, instâncias reais, tokens, topologias sensíveis e URLs internas em repositório público.
- Quando a especificação mudar, atualizar o diagrama no mesmo PR e revalidar com `python -m unittest discover -s scripts/docs -p 'test_*.py'` e o build MkDocs.
- Nos módulos ainda não auditados, não criar diagramas inventados: primeiro verificar fonte e contratos públicos, depois completar o capítulo de arquitetura.

## Leitura ampla e índice local

A barra lateral esquerda contém apenas entradas principais e áreas com fichas dos módulos. O sumário da **página atual** ocupa a coluna direita em telas amplas (`toc.follow`), sem misturar suas seções ao catálogo global. A referência técnica reúne fontes reais e anchors fixos para contratos públicos, métodos internos, decorators HTTP, frontend, SQL e dependências do manifesto.

## Modelo documental de seis páginas (sem seis subitens no menu)

As seis páginas continuam preservadas e ligadas pela ficha de cada unidade:

- **Visão geral:** ID, owner, fontes e acesso às outras páginas.
- **Especificação:** `ESCOPO.md` e capítulos, requisitos e diagramas.
- **Referência técnica:** stack, exports públicos, declarações privadas, interfaces, HTTP, SQL e dependências com fontes verificáveis.
- **Evolução:** workpackages e tasks com links para Issues/Projects, sem copiar estados concorrentes.
- **Histórico:** alterações Git e vínculos explícitos do registro de rastreabilidade.
- **Operação:** status, sprint, runbooks, monitoramento e validação.

O catálogo técnico usa uma camada por vez e não atribui contratos/rotas a um módulo sem indícios no inventário. Prompts, `STATUS` e `SPRINT` não viram níveis novos do menu. Ausência de declaração no extrator **não** comprova inexistência; presença **não** comprova instalação, habilitação ou homologação.

## Componentes de um módulo não viram novos módulos no menu

Unidades do catálogo que representam um **componente interno** de outra unidade podem declarar `documentationParent`. Permanecem no catálogo e com seus caminhos de fonte, testes, WBS, histórico e prompts, mas não geram entrada própria na navegação principal.

Exemplo real: **I09 Whatsmeow Runtime → P03 WhatsApp**. O runtime é um sidecar Go de protocolo; o plugin NestJS e o domínio de WhatsApp são componentes do P03. Suas documentações históricas seguem com URL estável; novos assuntos ficam nas páginas Referência técnica, Evolução e Operação do P03.

A hierarquia lateral permanece **Área → ficha do módulo**; suas páginas internas preservam os caminhos canônicos. Essa relação não reatribui tarefas, não muda ownership do código nem autoriza deploy. **Não** agrupar módulos de negócio numa área artificial chamada "Plugins": plugin é um mecanismo técnico de composição.


## Leitura por áreas funcionais e abas do módulo — 2026-11-12

A barra lateral é organizada por **áreas funcionais de apresentação**, sem alterar a propriedade canônica em `catalog/work-units.json`: Plataforma Core, Segurança e Acesso, Canais e Comunicações, Atendimento, CRM, Organizações e Usuários, Automação e IA, Documentos e Integrações, Manager e Interfaces, Faturamento e Comercial, Suporte e Operação, Infraestrutura, Qualidade, Arquitetura e Governança. Cada uma das **49 entradas principais** aparece exatamente uma vez. Os oito componentes históricos vinculados a um owner não viram módulos duplicados.

A ficha de cada unidade possui **rotas independentes**, uma por aba: Visão geral, Documentação, **APIs**, **Dados**, **Contratos**, **Código**, **Dependências**, **Testes**, Projetos (WBS), **Operação**, Versões e Prompts. Não se trata de âncoras diferentes apontando para a mesma página. O build materializa `APIS.md`, `DADOS.md`, `CONTRATOS.md`, `CODIGO.md`, `DEPENDENCIAS.md` e `TESTES.md` no **site gerado**, para os 49 módulos principais, separando as seções existentes da referência técnica e do inventário sintático por responsabilidade. Cada página tem URL e índice local próprios; a antiga `REFERENCIA-TECNICA.md` continua acessível para preservar links históricos e não vira uma segunda fonte de manutenção.

**Modelo de informação:** Markdown autorado é a fonte normativa de requisitos e explicações; o inventário JSON derivado do código/manifests fornece símbolos e evidências; HTML/CSS/JavaScript cuidam só da apresentação e da navegação. XML não é requisito para esta separação. As páginas de cada assunto não devem ser editadas diretamente na saída do MkDocs: o editor contextual envia propostas referenciando o arquivo Markdown original ou a fonte de código, com SHA e tópico. Quando uma referência ainda mistura assuntos no mesmo arquivo autorado, o gerador distribui os trechos por página de leitura, preservando a origem para posterior revisão editorial.

A leitura do corpo de cada assunto permanece vertical, com sumário local à direita. O build gera o hub Prompts a partir de `PROJECAO.md`, `IMPLEMENTACAO.md` e `ALTERACAO.md`, sem criar requisitos novos.

Cada tópico e subtópico em Markdown autorado (H1–H6) oferece **Editar** e **Acrescentar**, que preparam proposta contextual por Issue ou prompt — nunca fazem escrita direta no site. Seções extraídas automaticamente do código apresentam **Sugerir revisão**: a fonte a modificar é o código proprietário, e não o Markdown derivado.

O painel [Projetos](../blueprint/PROJETOS.md) usa `catalog/evolution-associations.json` para vincular áreas/módulos às tarefas da WBS e às páginas de Status e Sprint. É uma visão de **planejamento versionado**, não um dashboard de execução em tempo real. O GitHub Project somente será fonte de status depois de sincronização e autorização confirmadas.

### Escopo de alteração de agentes

O hub Prompts mostra os caminhos permitidos por owner e recomenda `python3 scripts/docs/verify_module_scope.py --module P03 --base origin/main` no diff antes de qualquer entrega. O verificador falha com arquivos de outros owners e caminhos com propriedade compartilhada ou sobreposta; nesses casos, é necessária decisão de integração. **Prompt e verificação local não substituem controle de permissões**: bloquear de fato alterações exige workspace isolada ou gate de CI independente.
