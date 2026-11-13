# Biblioteca Syndes — modelo de navegação operacional

## Princípio

A documentação responde a uma pergunta de cada vez. **Módulo → função → operação** define o caminho humano. Dentro de uma operação, apresentar uma ficha de comportamento e, sob demanda, detalhes técnicos, critérios de aceite, referências e um briefing para o agente.

A organização original de **12 assuntos técnicos** permanece como catálogo de referência por módulo. Não deve ser duplicada nas operações. Na implementação-piloto, ela continua em `lib/content.js` e `lib/crm-evidence.js` e é consultada pelo modo **Referência técnica** em cada função.

## Fontes

- `lib/crm-functions.js`: taxonomia de funções e grupos dos assuntos técnicos.
- `lib/crm-operations.js`: catálogo de fichas operacionais, identificadores estáveis e fontes verificáveis.
- `components/operation-detail.jsx`: leitor progressivo, briefing e propostas por operação.
- `components/reading-section.jsx`: referência técnica original por assunto.
- `components/proposal-editor.jsx`: sugestões locais, sem persistência compartilhada.

O módulo CRM é o único piloto. A classificação funcional é específica do CRM. Outros módulos devem definir suas próprias funções; não copiar cegamente Cadastros ou Atendimento.

## Campos obrigatórios da ficha

| Campo | Uso |
|---|---|
| `id` / `group` | Link direto e função proprietária; não reutilizar ID de outra operação |
| `title`, `kind`, `objective` | Responder qual operação e por quê |
| `behavior` | Sequência de ações do código/contrato |
| `inputs`, `output` | Dados de entrada e resultado |
| `rules` | Validações e restrições de segurança |
| `contract` | Método, HTTP **declarado**, permissão e persistência |
| `evidence`, `state` | Prova disponível e limites de homologação |
| `acceptance` | Critérios verificáveis, incluindo negativos e tenant A/B quando aplicável |
| `task` | Trabalho focado candidato, sem autorização automática |
| `sources` | Caminhos canônicos versionados; mostrados **após** a explicação |

Se um item não foi encontrado no código, identificá-lo como lacuna. Não inventar endpoint, tela, teste ou status. Não declarar um gate fechado a partir de arquivo ou teste unitário isolado.

## Fluxo para agentes

O botão **Exportar briefing .md** gera uma tarefa contextual e limitada a **uma única operação**. O briefing contém objetivo, regras, método, permissão, persistência, critérios de aceite e fontes.

O agente deve primeiro verificar a SHA e o estado atual do código; depois planejar a alteração, realizar testes, registrar evidências e aguardar aprovação dos gates pertinentes. A exportação não cria PR nem autoriza migrations, deployments, alteração de permissões, ativação multi-org ou mudanças de produção.

## Evolução e testes

1. Cadastrar uma operação por vez a partir de fontes verificadas.
2. Associá-la a exatamente uma função, preservando um identificador estável.
3. Não remover nem duplicar os 12 assuntos técnicos da camada de referência.
4. Exigir `npm test`, build Next.js e Playwright desktop/mobile antes de publicar.
5. Manter a sequência editorial: **explicação → comportamento → regras → detalhes sob demanda → critérios/briefing → fontes → propostas de melhoria**.

**Limitação do protótipo:** as propostas ficam em localStorage no navegador. A exportação de Markdown é manual. Não há persistência central nem execução automática.
