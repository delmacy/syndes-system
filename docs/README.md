# Syndes — documentação de referência dos agentes
> **Ponto de entrada**: este índice serve para localizar arquivos exatos no GitHub, sem busca exploratória pelo repositório inteiro.

## Leitura direta
- [Blueprint Geral (índice e referências existentes)](blueprint/README.md)
- [57 unidades: escopo, status e sprint](subprojects/README.md)
- **Evolução por módulo:** em cada unidade, página Evolução com workpackages, tasks e dependências vinculadas à WBS.
- [Painel de monitoramento dos workflows](monitoramento/README.md)
- [Catálogo JSON com paths para o portal](subprojects/index.json)
- [Contratos públicos, bibliotecas e interfaces](standards/CONTRATOS-PUBLICOS.md)
- [Como editar um tópico e enviar à caixa de entrada](standards/EDICAO-CONTEXTUAL.md)
- [Prompt de projeção](standards/PROMPT-PROJECAO.md)
- [Prompt de implementação](standards/PROMPT-IMPLEMENTACAO.md)
- [Prompt de alteração rápida (modelo)](standards/PROMPT-ALTERACAO.md)
- [Fluxo de propostas, atualização e implementação](standards/FLUXO-DE-ATUALIZACOES.md)
- [Modelo de atualização aprovada](standards/TEMPLATE-ATUALIZACAO.md)
- [Template do contrato público](standards/TEMPLATE-CONTRATO-PUBLICO.md)

## Rotina do agente
1. Receber ID da unidade e caminho direto do capítulo/tópico.
2. Consultar **somente** seu escopo, status/sprint, regras obrigatórias e contratos públicos relevantes.
3. Executar apenas a atividade dentro da unidade autorizada; impacto externo vira referência e bloqueio, nunca trabalho não autorizado.
4. Registrar progresso com evidência no STATUS e consolidar sprint na meta.
5. Alterar ESCOPO aprovado apenas mediante decisão explícita; ideias adicionais ficam como propostas.

**Importante:** os textos de scaffold são rascunhos e não substituem PRDs, ADRs, definições de runtime, GitHub Actions e testes já existentes.

## Três níveis de navegação

**Área → Módulo → Página.** A página Escopo apresenta capítulos, tópicos, histórias, capacidades, contratos e diagramas no próprio corpo da documentação. Cada capítulo continua em arquivo Markdown individual para edição e consultas precisas de agentes.
