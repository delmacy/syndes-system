# G03 — Divergência de contrato de seleção CI (2026-11-15)

- **Base GitHub main auditada:** `1cf48cc0a1281017ac58f7b9b9747f663109e151` (confirmada por busca de commits; não presumir atualização posterior sem nova consulta).
- **Owner:** G03 Engenharia e Git; interface com Q01/Q07/Q10 e P05 Service Management.
- **Evidência fonte:** `scripts/ci/plan.mjs` blob `f7b1135ace2fc24bb6b88f41f0ed4993cfc9d41a`; `AGENTS.md` blob `02433a107ee5a042e80673445dc48d52a0437089`.

## G03-NEW-01 — Contradição documental confirmada

O AGENTS.md afirma em “Gestão de Atendimentos no MVP” que o planner mainline ainda não roteia a suíte do novo módulo, incluindo Nest HTTP/PG17. Entretanto o catálogo executável do planner já declara `service-management` com marker `modules/service-management/package-lock.json` e Node 22; `selectSuites` inclui a suíte em mudanças `modules/service-management/`, e também em mudanças `modules/core-crm/` e `modules/inbox/`, além de modo full. A documentação precisa diferenciar seleção de suíte, presença do marker e execução/resultado de testes específicos Nest HTTP/PG17; a primeira está implementada, as demais não foram comprovadas nesta inspeção. Não corrigir o texto afirmando aprovação de CI.

## Fronteiras e evidências

- **Contrato público:** regras de engenharia e Definition of Done em AGENTS.md. **Contrato interno:** função exportada `selectSuites`, catálogo e `installedSuites` no planner. O planner gera matriz JSON, não executa diretamente os testes.
- **Classes/APIs/eventos/schema/migrations:** G03 não define controller HTTP, classes de domínio, eventos de negócio ou migrations próprios nos arquivos examinados. Migrations de Service pertencem a P05 e exigem auditoria separada.
- **Teste e evidência:** leitura estática dos dois arquivos. Não foi inspecionado o workflow que consome a matriz nem os logs de Actions; não se afirma que suites PG17 sejam invocadas ou aprovadas.
- **Não executado:** testes, builds, SQL, migrations, Docker, CI, deploy e operações no DevServer01. Nenhuma alteração de código, workflows ou branches de outros agentes.
- **Estado:** divergência documental aberta; existência de roteamento estático confirmada, sucesso de testes e implantação/homologação não comprovados.

## Gate de reconciliação

Inspecionar o workflow real, os scripts de `modules/service-management/package.json` e checks por SHA; reconciliar AGENTS.md somente em branch própria de documentação, com revisão e sem afetar escritores concorrentes. Verificar SHA público de GitHub Pages separadamente. Este checkpoint não autoriza merge.
