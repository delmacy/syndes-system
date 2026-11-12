# Syndes Docs — fontes de verdade e rastreabilidade

> **Padrão obrigatório de documentação e engenharia.** Uma interface única não significa um único arquivo ou duplicação de dados. O portal reúne fontes verificáveis com IDs estáveis e links explícitos.

## 1. Identidade e proprietário de cada registro

| Objeto | Fonte canônica | O que o portal pode exibir |
|---|---|---|
| Área / módulo / owner | `catalog/work-units.json` | Identidade, fronteira e caminho do código |
| Escopo aprovado / requisitos | `docs/subprojects/<ID>-<slug>/chapters/*.md` e alterações aprovadas | Tópicos, IDs, critérios de aceite, versões |
| Referência de API / métodos / schema | `package.json#exports`, código, SQL, OpenAPI e contratos públicos | Inventário com estado de auditoria, links e assinatura |
| Workpackages e WBS | `docs/subprojects/*/EVOLUCAO.md` e WBS de origem | Planejamento e dependências, não evidência de implementação |
| Trabalho rastreado | GitHub Issues / Projects | Status atual e responsável quando houver vínculo explícito |
| Código implementado | Commits e PRs do repositório | Alterações realizadas com SHA, não deploy |
| Testes e build | GitHub Actions / resultados assinados pelo SHA | Evidências reais, skips e falhas separados |
| Deploy em ambiente | Jobs de deploy e evidência de ambiente/versão | Entrega técnica somente quando comprovada |
| Homologação e aceite | Decisão humana vinculada ao requisito e cenário | Aceite nunca inferido de CI verde |
| Decisões de arquitetura | ADRs em `docs/engineering` | Contexto, alternativas, consequências e substituição sem apagar histórico |
| Operação | STATUS, runbooks e evidência de ambiente | Gates, incidentes, dependências e rollback |

**Regra:** usar IDs e links; não repetir estados do GitHub Projects como tabela Markdown com estado manual concorrente. Um catálogo de links não é um banco de verdades.

## 2. Navegação e apresentação

A navegação tem **três níveis máximos**: Área → Módulo → Página.

| Página | Conteúdo |
|---|---|
| Visão geral | Ficha de identidade, ownership, caminhos e conexões |
| Especificação | Escopo, capacidades, histórias, regras e diagramas; capítulos Markdown continuam arquivos independentes |
| Referência técnica | Stack, classes/métodos públicos, APIs, contratos, frontends, schemas Tenant/Control, testes |
| Evolução | WBS, workpackages, dependências, propostas de sprint e links para Issues/Projects |
| Histórico | Linha do tempo gerada de Git, decisões, incidentes, testes/deploy/aceite com prova |
| Operação | Checkpoints, status, sprint, runbooks, atualização, três prompts dos agentes |

Os documentos originais `STATUS.md`, `SPRINT.md`, `PROJECAO.md`, `IMPLEMENTACAO.md`, `ALTERACAO.md` e `updates/README.md` **permanecem nos mesmos caminhos**. São acessados por links dentro das páginas, mas não criam profundidade extra no menu.

## 3. Identificadores e campos do vínculo

- Módulo: `P01` / `P02` etc., conforme catálogo.
- Requisito: ID estável documentado no capítulo (não inventar ao importar WBS).
- Workpackage: `P01-WP-VAL` ou `WP-50`, com fonte exata e ownership conferido.
- Task: `P01-VAL-01` ou tarefa mestre `50.02`, mantendo relação sem fundir IDs.
- Issue: `#106`, **somente se verificada**. PR, commit SHA, CI/run, deploy e aceite podem ser nulos.
- Documento de evidência: caminho real no repositório + commit/ambiente quando conhecidos.

`catalog/traceability-links.json` é um **índice de ligações**, não um espelho de status. O teste de integridade exige que o módulo, documento e tarefa existam. Qualquer campo sem origem permanece `null`.

## 4. Ciclo de vida e critérios

`PROPOSTA → EM ANÁLISE → APROVADA → PRONTA PARA IMPLEMENTAÇÃO → IMPLEMENTADA → TESTADA → INTEGRADA → OPERACIONAL → ACEITA`.

Estados não são promovidos por publicar documentação nem por encontrar um commit. Cada transição necessita gate e prova apropriada. Uma tarefa pode ser executada, mas não integrada; um deploy pode ocorrer sem aceite.

## 5. Linha do tempo planejada vs. realizada

- **Planejada:** workpackages, prioridades, dependências e datas explicitamente atribuídas em GitHub Projects/Issues. Sem datas, **não desenhar Gantt fictício**.
- **Realizada:** últimos commits efetivos do código e da documentação exibidos pelo build, com SHA e data do Git. A trilha é histórica, não inferência de deploy/aceite.
- **Reconciliação:** links explícitos de requisito → WP → task → Issue → PR → commit → teste → deploy → aceite. Ausências aparecem como lacunas.

A linha do tempo renderizada pode ficar **defasada em relação à main** até o próximo deploy do site. A página informa a revisão de build e aponta para GitHub como fonte atual.

## 6. Fluxo do agente

1. Receber ID, caminho do capítulo e proposta/Issue.
2. Ler somente Especificação, Referência técnica, Evolução, Operação e contratos públicos diretamente necessários.
3. Elaborar e aprovar incremento; criar IDs e vínculos sem inventar trabalho adicional.
4. Implementar, testar, registrar PR/commits, CI, ambiente, rollback e aceite, conforme gates.
5. Atualizar o documento normativo e o índice de vínculos; o Histórico de commits é regenerado pelo pipeline.

**Segurança:** o repositório e o Pages são públicos. Não publicar DSNs, tokens, PII, configuração privada, URLs internas ou segredos; índices públicos não devem expor dados de clientes.
