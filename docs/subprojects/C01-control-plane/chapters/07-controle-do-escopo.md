## 7. Divergências, riscos, continuidade e fronteiras

| Prioridade de investigação | Fato evidenciado | Responsável e ação |
|---|---|---|
| **P0 — schema Control incompatível com novos consumers** | Catálogo/releases/entitlements/audit/outbox ausentes; seis migrations Control PENDING | C01/A04/A05/C02/C06: reconciliar versão de runtime e dependências; sem migration automática |
| **P0 — tenant administrativo active não equivale a módulos operacionais** | Um tenant `active` no registry, mas sem estruturas de lifecycle de módulo no Control | C01/G02: proibir inferência “cliente ativo = módulos habilitados”; verificar em cada gate |
| **P1 — inventário Manager pode falhar por SQL ausente** | `GET /v1/platform/admin/tenants/:id/modules` consulta `module_catalog` e installs | A05/C01: testar HTTP quando schema for compatível; estado funcional atual **não comprovado** |
| **P1 — delegação Account não instalada neste Control** | `tenant_account_role_grants/audit` ausentes | A06/C01: conferir dependências, funções/roles e FGA, sem concessão de privilégios |
| **P1 — eventos Control são somente contrato** | `control_events` ausente no runtime; CP-G02/03 bloqueados | C06/C01: não iniciar dispatcher, não declarar replay ou inbox ativo |
| **P1 — grants básicos corretos mas cobertura incompleta** | SELECT permitido a core/Manager, sem DML de dados de perfil; roles de operação de módulo ausentes | C01/I04/Q05: negativas A/B, testes de serviços e privilégio mínimo |
| **P1 — backup/restore operacional não comprovado** | Testes CI descartáveis, sem recovery de `syndes_control` persistente | I10/I11/Q08: restore/rollback, RPO/RTO e aprovação |
| **P1 — outros hosts não examinados** | `server02`, `win1-server` offline no conector | I02/C01: staging/produção não verificados, nunca presumir serviços desligados |
| **P2 — WBS “worktree” não é deploy** | CP-E01..E07 marcados “implementado na worktree” na fonte | G03/C01: registrar que fontes hoje existem no main, mas **nenhum apply operacional** |

### Checklist do checkpoint

- [x] Catálogos de Control consultados em transação somente leitura, sem PII/segredos.
- [x] 1 tenant `active` observado no registry; nenhuma identidade real divulgada.
- [x] Verificada presença de tabelas base e ausência de catálogo, lifecycle, Account e events.
- [x] Roles `syndes_module_operator`, `syndes_module_installer`, `syndes_module_activator` ausentes.
- [x] Runner oficial `--plan` confirma seis stages pendentes, sem criar ledger/DDL.
- [x] Contratos do Kernel/Host/Manager/Account/Events diferenciados por owner e fonte.
- [x] WBS CP-E/CP-G e tarefas 20/30/40/55/90 preservadas, sem promover estados.
- [ ] Comparação de release/serviço efetivo com o schema instalado ratificada pelos owners.
- [ ] Backup/restore real e plano de rollback aprovados.
- [ ] Staging/produção, testes de identidade/FGA, Manager e tenant A/B homologados.

**Limites da entrega:** somente documentação e testes documentais. Nenhum arquivo de runtime, API, migrations SQL, grants, roles, container, workflow CI, worker ou banco foi modificado. Não executar `--apply` para “fechar” a divergência.

**Próxima unidade:** **C03 — Identity Keycloak**. O C01 segue em **auditoria parcial**, com gates operacionais separados.
