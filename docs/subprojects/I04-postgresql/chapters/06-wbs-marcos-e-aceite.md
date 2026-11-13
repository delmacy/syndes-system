## 6. WBS, marcos e critérios de aceite

A [EVOLUÇÃO](../EVOLUCAO.md) é a ligação canônica dos **7 IDs** ao [programa](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md). O estado foi preservado do snapshot original; a auditoria de documentos **não executa** tasks ou Product Gates.

| ID de origem | Objetivo/gate | Estado da WBS | Fato conhecido após auditoria |
|---|---|---|---|
| **10.02** | Revisar roles, CONNECT e grants A/B por banco | **PEND** | No único tenant: PUBLIC/core/master não conectam e owner exclusivo não tem superuser; falta teste funcional/roles completas |
| **10.07** | Backup/restore de Control e tenants, RPO/RTO | **BLOQ (operação)** | Teste sintético de CI existe; restore de ambiente persistente **não verificado** |
| **40.02** | Provisionar Syndes como tenant convencional | **BLOQ** | 1 DB com nome canônico existe; não é possível atribuí-lo ao tenant Syndes sem conferir mapping autorizado |
| **40.08** | Migrations de Support somente no tenant Syndes, com restore | **BLOQ** | Nenhum schema Support observado; sem aplicação ou prova de backup/restore |
| **55.03** | Installer, gates de canonicidade e schema | **BLOQ em Control/restore/FGA reais** | Código e CI em PG17 existem; Control live carece de catálogo e ledger/tenant sem schema |
| **60.02** | Auditar Organization SQL 001–006 + CRM/Inbox/WhatsApp | **BLOQ** | Arquivos versionados, schemas ausentes no tenant canônico observado |
| **60.03** | Ativação manual multi-org transacional com rollback | **BLOQ** | Não aprovada/aplicada nesta auditoria; manter guardas do SQL 002 |

### Evidências por gate

| Gate | Prova necessária | Situação |
|---|---|---|
| Estrutura/bancos | PostgreSQL e databases de sistema presentes | **Observado no DevServer01** |
| Roles no SQL | CONNECT e superuser/ownership negativos | **Observado no único tenant**, não em todos ambientes |
| Objetos Control | Catálogo e events instalados com ledger versionado | **Não observados; seis Control migrations PENDING** |
| Migrations tenant | Ledger + schemas por módulo e estado ENABLED | **Ausentes no tenant canônico consultado** |
| Testes descartáveis | CI por SHA e suíte PG17 | [Run 43355545663](https://github.com/delmacy/syndes-system/actions/runs/43355545663) **24/24** na baseline |
| Backup/restore operacional | DR demonstrado, snapshots, tempo e reversão | **Não verificado** |
| Staging/produção | Operação e aceite no host-alvo | **Não verificados** |

### Prioridade e próximos passos por responsabilidade

1. **I04/C01:** reconciliar `syndes_control` e histórico de migrations com o migrador `--plan`, identificar owner e estado de operação antes de qualquer `--apply`.
2. **C02/A04:** identificar finalidade do DB de tenant existente e conferir condições de instalação; **não** aplicar SQL para preencher lacuna documental.
3. **I04/I02:** classificar o DB extra sem expor seu identificador, confrontar imagem/volume e plano de retenção.
4. **I10/Q08:** comprovar backup/restore e rollback em staging autorizado, com RPO/RTO quando houver medição.
5. **I04/C03/C04/A05:** ampliar matriz de grants com testes negativos reais, sem consultar dados privados.
6. **G02/owners:** Product Gate separado para Support, módulos, multi-org e Client/Manager.

**Próxima unidade da ordem de auditoria:** **C01 — Control Plane**. O fato de o migrador Control listar pendências é um insumo técnico para C01, não autorização para executá-las.
