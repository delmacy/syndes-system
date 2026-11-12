# Fluxo de atualização do Syndes — do texto até o incremento testado

**Objetivo:** permitir que uma observação em uma página da documentação vire um incremento bem especificado, com rastreabilidade e sem ampliar escopo por acidente.

## Entrada: uma atualização escrita pelo usuário

Em qualquer capítulo, clique **Propor alteração neste tópico**. Escolha o tipo: alteração, nova capacidade, história de usuário, correção, integração, acréscimo ou remoção. Descreva o resultado desejado. O sistema anexa automaticamente o **caminho canônico, título, linha, revisão e conteúdo original**, mas não executa alterações.

Você pode então:
1. **Copiar prompt de projeção**, levando a descrição completa para uma conversa nova.
2. **Enviar à caixa de entrada**, abrindo uma Issue no GitHub para confirmar e salvar a solicitação; copiar a URL da Issue para o chat do agente.

A Issue é pública neste repositório. Não registrar senhas, segredos, dados de clientes ou informações operacionais sensíveis.

## Projeção: agente especializado do módulo

O agente lê a proposta, o capítulo escolhido, o `PROJECAO.md` do módulo e **somente** contratos públicos externos indispensáveis. Deve:
- Separar observações do usuário de requisitos já aprovados.
- Tirar dúvidas sobre ambiguidades, regras, edge cases, UX, contratos, dados e critérios de aceite.
- Avaliar compatibilidade e impactos; dependências de outro módulo viram encaminhamento, não implementação.
- Preparar texto refinado e uma lista de mudanças **propostas** sem executar código.
- **Após aprovação explícita**, atualizar o capítulo normativo e criar `docs/subprojects/<ID>-<slug>/updates/<ID>-UPD-0001/REQUISITO.md` com os critérios e `IMPLEMENTACAO.md` com o prompt de implementação específico.
- Registrar a decisão e o SHA no documento da atualização, sem marcar como testado ou operacional.

## Implementação: outro chat, escopo aprovado

O usuário copia o prompt específico `updates/<ID>-UPD-0001/IMPLEMENTACAO.md`. O agente executor lê o documento de atualização, o capítulo, STATUS/SPRINT, os contratos públicos necessários e o código **exclusivamente do módulo**. Implementa e testa o incremento autorizado. Impacto externo exige novo encaminhamento.

## Estados que não podem ser confundidos

`PROPOSTA → EM ANÁLISE → APROVADA → PRONTA PARA IMPLEMENTAÇÃO → IMPLEMENTADA → TESTADA → INTEGRADA → ACEITA`

A transição não acontece só porque foi enviada uma Issue ou porque o CI passou. Registre gates e evidências por incremento.

## Fonte de verdade

- **Issue:** registro da proposta e discussão, não requisito aprovado.
- **Capítulo Markdown:** especificação normativa aprovada do tema.
- **REQUISITO.md:** decisão, rastreabilidade, critérios e WBS da atualização.
- **IMPLEMENTACAO.md:** prompt detalhado de trabalho para o agente executor.
- **STATUS.md / SPRINT.md:** andamento e comprovação, não nova especificação.
- **Código e testes:** evidências executáveis; não são substituídos pelos documentos.

## Ajuste rápido (terceiro prompt)

Para uma mudança localizada e clara, selecione o tópico e use **Copiar prompt de alteração**, ou abra ALTERACAO.md do módulo. O agente lê o caminho direto e executa apenas o ajuste, com testes e STATUS. Quando surgirem ambiguidades, contrato, migração ou funcionalidade não aprovada, não implementa e encaminha para Projeção/Planejamento.
