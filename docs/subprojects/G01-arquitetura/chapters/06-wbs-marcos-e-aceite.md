## 6. WBS, marcos e aceite

### Relação com a WBS mestre

A associação de G01 em `catalog/evolution-associations.json` **não transfere ownership nem prova execução**. As referências existentes são: 00.01 (baseline da `main`), 30.01 (matriz de papéis), 55.01 (recorte Basic de atendimento), 60.01 (gate multi-org), 80.01 (funil avançado, congelado) e 90.01 (métricas sanitizadas); ver [Evolução](../EVOLUCAO.md) e [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md).

### Checkpoint da presente revisão G01

| Tarefa documental | Evidência / saída | Situação em 12/11/2026 |
|---|---|---|
| Reconhecer owner e natureza da G01 | Catálogo + índice documental e diretório `docs/engineering` | Revisado no checkout; não runtime |
| Resumir decisões arquiteturais e status | Core Framework, ADRs de composição, Control/Tenant, identidade e Event Bus | Referências reconciliadas parcialmente |
| Confirmar superfície técnica em código | Exports Kernel, registry, `module-host.ts`, `config/modules.json`, manifests | Inspeção estática; sem execução E2E |
| Registrar contradições e lacunas | Diagrama `apps/core-api` histórico, nome de Inbox no índice de contratos, schemas-alvo e profiles | Pendências abertas, owners identificados |
| Aprovação da descrição pela governança do projeto | Revisão do responsável e resultado em STATUS/Issue | **Não aprovada nesta auditoria** |

### Critério para marcar G01 revisada/aprovada

1. Responsável valida a descrição das fronteiras, exclusões e a terminologia de domínio.
2. Donos dos contratos confirmam ou corrigem as divergências no documento de origem.
3. A WBS e as ADRs ficam ligadas a decisões e evidências; mudanças de arquitetura exigem novo gate, não atualização silenciosa de texto.
4. Quality Gates registra a evidência de testes e CI por SHA; nenhuma afirmação de integração depende apenas de presença de arquivo.

**Próxima unidade na ordem documental:** G02 — Produto e UX. A G01 pode permanecer **auditoria parcial** até confirmação do responsável e reconciliação das discrepâncias.
