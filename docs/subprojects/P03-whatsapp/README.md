# P03 — WhatsApp | Entrada

- Catálogo: catalog/work-units.json
- Código/artefato: modules/whatsapp
- AGENTS global: AGENTS.md
- AGENTS local: modules/whatsapp/AGENTS.md
- Package/exports: modules/whatsapp/package.json
- Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
- Escopo: docs/subprojects/P03-whatsapp/ESCOPO.md
- Status: docs/subprojects/P03-whatsapp/STATUS.md
- Sprint: docs/subprojects/P03-whatsapp/SPRINT.md

Leia somente o escopo desta unidade, o status, a sprint, as instruções operacionais obrigatórias e os contratos públicos diretamente necessários. Não assuma responsabilidade interna por outros módulos.

7. **Assuntos editáveis:** [Capítulos da especificação](ESCOPO.md) · [Atualizações e propostas](updates/README.md).

8. **Alteração rápida:** [Prompt curto por módulo](ALTERACAO.md).
9. **Evolução planejada:** [Workpackages e tasks](EVOLUCAO.md).


## Mapa documental integrado

| Página | Objetivo |
|---|---|
| [Especificação](ESCOPO.md) | Requisitos, histórias de usuário, regras de negócio e diagramas aprovados |
| [Referência técnica](REFERENCIA-TECNICA.md) | Stack, métodos, contratos públicos, frontend e schemas |
| [Evolução](EVOLUCAO.md) | WBS, workpackages, tasks, dependências e planejamento |
| [Histórico](HISTORICO.md) | Linha do tempo dos commits de código/documentação e vínculos de evidência |
| [Operação](OPERACAO.md) | Status, sprint, gates, runbooks e os três prompts de agentes |

**Fonte de verdade:** o catálogo define o proprietário; o Git registra as alterações; Issues/Projects cuidam da execução; Actions e evidências de ambiente comprovam testes/deploy. Não promover status por inferência.

## Composição funcional

**WhatsApp é um único módulo.** O plugin TypeScript/NestJS e o sidecar Go/Whatsmeow são componentes técnicos de P03. Consulte [Referência técnica](REFERENCIA-TECNICA.md#composicao-do-modulo-plugin-nestjs-e-gateway-go), [Operação](OPERACAO.md#operacao-do-gateway-whatsmeow-componente-i09) e [Evolução](EVOLUCAO.md#gateway-whatsmeow-rastreabilidade-i09-dentro-de-p03).

O identificador **I09** permanece no catálogo apenas para preservar rastreabilidade de trabalho e documentação legada, sem entrada separada no menu principal.
