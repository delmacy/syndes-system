# P01 — CORE CRM
## ESCOPO DE SUBPROJETO · REVISÃO PARA IMPRESSÃO

**Versão do rascunho:** 0.1 · **Data de referência:** 11/11/2026
**Estado da especificação:** EM DISCUSSÃO — NÃO APROVADA
**Subprojeto:** P01 · Categoria: Produto e integrações
**Proprietário lógico:** Core CRM · **Pacote:** `modules/core-crm`
**Código frontend consumidor:** `apps/workspace-web/src/features/crm.tsx`, `crm-person-detail.tsx`
**Host:** `apps/core-host` · **Kernel:** `packages/core-kernel`
**Documento de execução:** [STATUS.md](STATUS.md) · **Sprint:** [SPRINT.md](SPRINT.md) · **Código:** `modules/core-crm`
**Requisitos já existentes:** [Aceite CRM MVP](../../product/CORE-CRM-MVP-ACCEPTANCE.md) · [Fechamento frontend](../../product/CORE-CRM-FRONTEND-COMPLETION.md) · `modules/core-crm/AGENTS.md`

> **Leitura obrigatória do agente:** AGENTS.md da raiz → AGENTS.md do CRM → este ESCOPO.md → STATUS.md → contratos de código referenciados. Não transformar pendências de aceite em funcionalidades inexistentes; não presumir que código aprovado localmente está operacional para clientes.

---

---

<!-- SYNDES-DOCS-CHAPTER-INDEX:1 -->
## Índice de capítulos (fonte canônica por assunto)

Cada capítulo abaixo é um arquivo Markdown independente. **Este índice não replica requisitos nem aprova funcionalidades.**

- [1. Missão e resultado de negócio](chapters/01-missao-e-resultado-de-negocio.md)
- [2. Fronteiras e propriedade de dados](chapters/02-fronteiras-e-propriedade-de-dados.md)
- [3. Público, atores e jornada principal](chapters/03-publico-atores-e-jornada-principal.md)
- [4. Catálogo de capabilities propostas para rastreabilidade](chapters/04-catalogo-de-capabilities-propostas-para-rastreabilidade.md)
- [5. Contratos e interfaces oferecidos/consumidos](chapters/05-contratos-e-interfaces-oferecidos-consumidos.md)
- [6. Persistência, migrações e propriedade de schemas](chapters/06-persistencia-migracoes-e-propriedade-de-schemas.md)
- [7. Frontend — apresentação ao usuário](chapters/07-frontend-apresentacao-ao-usuario.md)
- [8. Requisitos não funcionais e falhas](chapters/08-requisitos-nao-funcionais-e-falhas.md)
- [9. Dependências e contratos opcionais](chapters/09-dependencias-e-contratos-opcionais.md)
- [10. Metas e WBS por entregáveis](chapters/10-metas-e-wbs-por-entregaveis.md)
- [11. Riscos, lacunas e decisões que exigem debate](chapters/11-riscos-lacunas-e-decisoes-que-exigem-debate.md)
- [12. Aceite final e controle de mudança](chapters/12-aceite-final-e-controle-de-mudanca.md)
- [Referências técnicas do repositório](chapters/13-referencias-tecnicas-do-repositorio.md)

## Solicitações e atualizações

- [Atualizações, novas capacidades e histórias de usuário](updates/README.md)
- [Status e evidências](STATUS.md)
- [Sprint atual e checkpoints](SPRINT.md)
- [Prompt de projeção](PROJECAO.md)
- [Prompt de implementação](IMPLEMENTACAO.md)

**Estado:** preservar o baseline e a aprovação indicados acima. Dividir arquivos não representa autorização para implementar, remover ou homologar funcionalidades. Ao citar um assunto, indicar o **caminho exato** em `chapters/`, não apenas este índice.
