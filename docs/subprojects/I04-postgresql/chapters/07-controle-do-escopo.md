## 7. Divergências, riscos e regras de intervenção

| Risco e gravidade de investigação | Evidência | Owner/encaminhamento |
|---|---|---|
| **P0 documental — seis migrations Control pendentes** | `--plan` listou 001–006 como PENDING, tabelas de catálogo/entitlements e events Control ausentes | C01/C02/C06 + I04: validar necessidade, estado do Host, histórico, backup e Product Gate **antes do apply** |
| **P1 — tenant DB sem schemas/ledger** | Um DB com nome canônico, `_syndes` e módulos não encontrados | C02/A04/owners: verificar finalidade; pode estar apenas provisionado |
| **P1 — DB extra fora das categorias catalogadas** | Catálogo PostgreSQL retornou um DB adicional, sem identificação pública | I04/I02: classificar com operador autorizado; não divulgar name/DSN |
| **P1 — risco de pressupor multi-tenant só por nome** | Há um DB e role por tenant observado; grants negativos básicos | C01/C04/Q05: testar isolamento A/B e autorizações efetivas das APIs |
| **P1 — Control e tenant schemas de eventos ausentes** | Catálogos Control/tenant auditados em modo read only | C06/A04: não iniciar worker ou tratar Outbox como operacional |
| **P1 — backup e recovery não comprovados** | `postgres-smoke.sh` usa restore CI descartável, não do volume do DevServer | I10/I11/Q08: ensaio restaurável, RPO/RTO, logs e rollback |
| **P1 — script init não reexecuta em volume existente** | `00-init.sh` em `docker-entrypoint-initdb.d` | I04/Operação: migration planeada com checksum, não edição manual ad hoc |
| **P1 — outros hosts offline** | `server02` e `win1-server` sem leitura | I02/I04: não inferir produção parada ou corretamente migrada |
| **P2 — código de APIs distinto dos grants SQL** | Host/modules têm adaptadores e testes próprios | A04/owners: verificar cada endpoint e entrypoint com JWT, membership e FGA |

### Checklist da auditoria (não de go-live)

- [x] Comparados Compose, `00-init.sh`, provisioner e SQLs da infraestrutura.
- [x] Consultado catálogo PostgreSQL no DevServer01 com `BEGIN READ ONLY` e sem ler linhas de clientes.
- [x] Confirmados databases técnicos e um tenant canônico; DB adicional sem classificação publicada.
- [x] Verificados `PUBLIC CONNECT`, `syndes_core` e `syndes_master_api` no tenant encontrado.
- [x] Confirmada ausência de catálogo/events Control e schemas de módulo/ledger tenant no runtime examinado.
- [x] Migrador oficial executado exclusivamente com `--plan`: 6 PENDING, sem alterações.
- [x] Revisados testes descartáveis e WBS, com gates preservados.
- [ ] Dono do banco e da versão instalada ratifica a comparação.
- [ ] Prova de backup/restore e migrations em ambiente autorizado.
- [ ] Staging/produção e negação real de API A/B homologados.

**Nenhum SQL de escrita foi executado nesta auditoria.** Não se aplicaram grants, schemas, migrations, provisionamento, dump, alteração de container, segredos nem troca de configuração. O registro dos gaps não representa autorização para corrigi-los.

**Próxima auditoria:** C01 — Control Plane, a partir dos objetos reais e das seis migrations Control pendentes; I04 permanece **auditoria técnica parcial**.
