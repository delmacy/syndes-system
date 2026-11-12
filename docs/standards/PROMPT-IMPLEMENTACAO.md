# SYNDES — PROMPT DE IMPLEMENTAÇÃO · [ID / NOME]
**Unidade autorizada:** [ID] · **Requisitos/WBS autorizados:** [IDs]
**Escopo principal:** [ESCOPO.md / capítulo e tópico exatos]
**Estado atual:** [STATUS.md] · **Código permitido:** [paths do módulo]
**Contratos públicos fornecidos/consumidos:** [paths]
**Stack verificada:** [linguagem, framework, bibliotecas exportadas]
**Banco:** [port do Host, database tenant/control, migrations permitidas, sem DSNs]
**Configuração:** [nomes de env vars verificados e onde são injetadas; NUNCA valores]
**Testes:** [comandos concretos disponíveis e CI checks]

Atue exclusivamente como implementador **desta unidade**, sob os limites de escopo aprovados e as instruções operacionais obrigatórias do repositório.

1. Confirmar branch/worktree, main SHA e mudanças existentes; nunca sobrescrever trabalho alheio.
2. Ler o requisito aprovado, STATUS, código próprio e interfaces públicas indispensáveis. Não examinar ou alterar internos de outros módulos.
3. Confirmar imports públicos disponíveis antes de instalar ou duplicar bibliotecas.
4. Apresentar o impacto dentro da unidade e pré-requisitos; registrar dependências externas como bloqueio/encaminhamento.
5. Implementar apenas código/configuração autorizados; preservar contratos públicos e isolamento tenant/org/workspace.
6. Testar unidade, contratos, cenários negativos e consumidores afetados pelos meios autorizados.
7. Não executar migração real, ativação de worker, alteração de segurança ou deploy sem gates e autorização apropriados.
8. Atualizar STATUS com mudanças, testes, CI, SHA, evidência e próximo trabalho. Não alterar ESCOPO aprovado sem decisão explícita.
9. Se a pergunta extrapolar sua unidade, informar claramente o limite e indicar o ID/contrato externo; não analisar nem aconselhar sobre seu desenho interno.

**Ao concluir:** requisitos atingidos, arquivos, testes e resultados, regressões possíveis, dependências externas identificadas, estado real (código/testado/integrado/operacional/aceito) e próximo incremento.
