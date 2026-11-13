## 1. Missão, objetivos e limites

### Missão da G03

Definir e documentar **como mudanças são propostas, delimitadas, desenvolvidas, testadas, integradas e rastreadas** no Syndes. Isso inclui contratos de agentes, fronteiras de owner, isolamento de worktrees, linha principal coerente, WBS, GitHub Issues/Projects, CI e evidências de publicação.

**Natureza:** G03 tem fonte `AGENTS.md`; **não** possui servidor, app, schema, controllers ou package de runtime. A implementação de CI pertence aos próprios workflows e scripts; sua mudança é uma frente específica, fora desta auditoria.

| Responsabilidade da G03 | Não deve realizar nesta revisão |
|---|---|
| Explicitar regras globais e locais dos agentes | Criar novas permissões de agente ou conceder acesso a hosts, dados e secrets |
| Manter matriz de owner e escalonamento entre módulos | Mudar código de CRM, Inbox, WhatsApp, Core ou frontends por conveniência |
| Especificar fluxo Issue → WBS → mudança → CI → deploy → aceite | Transformar Status ou commit em prova de produção |
| Distinguir verificador de escopo consultivo de isolamento efetivo | Afirmar que `verify_module_scope.py` impede escrita fora da worktree |
| Registrar riscos do pipeline e comportamento *fail-closed* | Alterar `main` protection, workflows ou critérios de testes sem escopo próprio |
| Garantir que documentação seja auditável e versionada | Tratar formulário de edição do Pages como gravação automática de Markdown |

### Princípios já estabelecidos pela fonte

- O produto permanece **monólito modular** quando não há necessidade demonstrada de separar serviços; imports públicos obedecem a `package.json#exports`.
- **`IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`**; todo gate deve indicar SHA, suite, ambiente e evidência. CI verde isolado não equivale a homologação.
- Agente trabalha sob `AGENTS.md` global e instruções locais aplicáveis ao arquivo; regra local não pode reduzir segurança, ampliar escopo ou trocar owner.
- Alterar contrato público, schema, autorização ou outra unidade exige análise de consumidores e **autorização de mudança transversal**; o verificador de caminho sozinho não constitui decisão.
- Worktrees separadas ajudam a não misturar diffs de frentes paralelas; não é permitido sobrescrever alterações não comitadas de outra frente no servidor.
- O `main` deve representar o código integrado e verificável; commits históricos não são todos releases. Não introduzir exigência de proteção do `main` não aprovada pelo proprietário.

**Consumidores:** agentes, engenheiros, tech lead, responsáveis de módulos, produto/qualidade e operadores autorizados. A G03 formaliza um processo, não substitui o julgamento dos donos de contrato e Product Gates.
