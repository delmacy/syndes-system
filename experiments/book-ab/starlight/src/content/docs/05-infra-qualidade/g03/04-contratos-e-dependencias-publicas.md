---
title: "G03 · Contratos e dependências"
description: "Volume Infraestrutura e qualidade · capítulo G03 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos de colaboração e dependências

**G03 não publica APIs HTTP, classes NestJS, eventos de negócio nem esquema SQL.** Seus contratos são políticas e formatos de governança.

| Contrato de processo | Produtor/source of truth | Consumidor e restrição |
|---|---|---|
| **Owner de unidade** | `catalog/work-units.json`, com `source`, `entry` e `documentationParent` | Agentes e portal; parent documental não muda dono do código |
| **Instruções de escopo** | `AGENTS.md` e o `AGENTS.md` mais próximo do arquivo | Agente deve aplicar ambas; regra local não pode enfraquecer global |
| **Superfície pública** | `package.json#exports`, contratos tipados/HTTP/eventos e owner respectivo | Dependente consome interface pública; não importar `src/` privado |
| **Solicitação de mudança** | Issue/PRD/ADR aprovado ou proposta de edição contextual | Issue não é aprovação; deve conter owner, diff/contrato, impacto e aceite |
| **Identidade de alteração** | Branch/worktree, SHA base, diff e commit | Revisão deve saber o que mudou; sem mexer em worktree de outra frente |
| **Impacto/teste** | `scripts/ci/plan.mjs` e testes relevantes | Suites selecionadas conforme impacto; gate separado e falha fechada |
| **Cronograma/status** | WBS + Issues + GitHub Projects (quando verificados) | Não duplicar progresso manual com status fictício |
| **Evidência de entrega** | CI/run SHA + deploy digest/ambiente + aceite explícito | Commit, CI, deploy e homologação são etapas diferentes |

### Contrato de trabalho de agentes

**Entradas mínimas:** `moduleId`, arquivo/tópico, objetivo aprovado, revisão base, limites, critérios de teste. **Saídas:** diff restrito, testes e comandos/resultados, risco residual, contrato afetado, commit/PR proposto e solicitação separada para consumidor externo.

**Fronteiras de escrita:** o agente é instruído a permanecer dentro do owner; `verify_module_scope.py --module <ID> --base origin/main` detecta caminhos inconsistentes, mas é **mecanismo consultivo**, como declara seu docstring. O controle de segurança real depende de permissões efetivas, revisão de alterações, autorização humana e gates apropriados. Uma exceção cross-owner precisa registrar o impacto e consentimento explícito; não burlá-la editando a regra.

### Comunicação entre módulos

- **Comando** pertence ao módulo de domínio que o executa.
- **Evento** versionado é publicado por producer autorizado e consumido por owner de destino, com idempotência, contratos e outbox quando aplicável.
- **API** exige identidade, membership/tenant, autorização por recurso e estado ENABLED.
- **DDL e dados** pertencem ao módulo dono do schema e ao instalador/operador; G03 não executa migrations.
- **UI compartilhada** fica em `packages/front-shared` apenas para apresentação; regras de sessão e dados continuam separadas.

**Dependências da G03:** AGENTS globais/locais, Git, catálogo, WBS/Issues, CI, documentação e políticas de segurança. Não há dependência de runtime PostgreSQL ou de credenciais da operação do produto.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/04-contratos-e-dependencias-publicas.md).
