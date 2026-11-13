## 3. Capabilities

| Capacidade | Fonte | Estado |
|---|---|---|
| Composição NestJS e plugins | `main.ts`, `module-host.ts` | Código versionado, runtime não verificado |
| Verificação JWT e FGA | `adapters.ts` | Adapters presentes; decisão real não verificada |
| Bootstrap OpenBao | `secrets.ts` | Contrato presente; segredo real não acessado |
| Tenant DB provider | `tenant-database.ts` | Contrato presente; PG17 não executado |
| Catalog/lifecycle/access/installer | `module-*.ts` | Gates distintos; implantação não verificada |
| Event worker/grants | `platform-event-*.ts` | Contrato presente; worker não ativado |

O frontend é propriedade de Workspace/Manager/Support; A04 só hospeda assets confiáveis declarados.
