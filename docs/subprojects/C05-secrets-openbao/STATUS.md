# C05 — Secrets OpenBao | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline `e86beda`; fontes Git e observação **somente leitura** do container no DevServer01. Container `syndes-security-access-openbao-1` observado **Up** (imagem `openbao/openbao:2.7.0`). Nenhum token, segredo, política ativa, conteúdo KV, seal/unseal ou endpoint administrativo foi consultado. Estado operacional e produção **NÃO HOMOLOGADOS**.

## Evidência por dimensão

| Dimensão | Verificado | Limites |
|---|---|---|
| Infra/Compose | Imagem versionada, HTTPS listener, rede privada `syndes-secrets`, Raft nomeado `openbao_raft` | Container Up ≠ unsealed, saudável ou cofre utilizável |
| Entrega de runtime | `render_runtime.py` usa AppRole, KV por serviços e escrita atômica em diretório montado; `run-renderer.sh` | Não foi executado nem validado o provisionamento real |
| Consumidor Core Host | `loadCoreSecrets` lê AppRole de arquivos, exige TLS, KV obrigatório, revoga token bootstrap | Testes mockados; app runtime real não validado |
| Manager | `render-master.py`, `operator-provision.py` e `run-renderer.sh` têm processo próprio | Regras aplicadas e efeito real não inspecionados |
| Policies | `policies/{core-host,core-tenant-db,keycloak,openfga,runtime-delivery}.hcl` declaradas | Templates no Git **não comprovam políticas ativas** |
| Testes | `apps/core-host/test/secrets.test.mjs` e script `tests/platform/openbao-smoke.sh` | Smoke é teste **descartável**; não foi executado contra o OpenBao atual |
| Operação | NÃO HOMOLOGADA | Inicialização, unseal, backup Raft, revogação, rotação, observabilidade e recuperação pendentes |

## Fronteiras e riscos

- **C05** é infraestrutura de segredos. **A04 Core Host** é proprietário de `loadCoreSecrets`; **Manager** tem renderer e operador próprios. Não promover implementações de consumers como API pública de C05.
- Os renderers podem produzir configurações para PostgreSQL/Keycloak/OpenFGA; **a existência do código de renderer não significa que todos os consumidores já migraram**, estejam configurados ou tenham retirado seus dados da distribuição por ambiente.
- `infra/security-access/openbao/README.md` descreve limitações explícitas de migração; reconciliar Compose e runtime-alvo antes de publicar estado final.
- O Raft usa um único volume/nó no Compose conhecido; criptografia por barreira depende de unseal; volume não substitui backup testado.
- P0: estado de unseal, mount KV, policies e grants efetivos desconhecidos; P0: cadeia de confiança TLS e entrega de AppRole não homologadas; P1: rotação e recuperação de desastre não demonstradas.

## WBS

| ID | Estado | Próxima entrega |
|---|---|---|
| C05.DOC.01 | **AUDITORIA PARCIAL** | Artefatos, contratos, testes e limites reconciliados |
| C05.SEC.01 | PENDENTE | Validação autorizada e sanitizada de seal/unseal, TLS, KV, AppRole e ACL de menor privilégio |
| C05.SEC.02 | PENDENTE | Matriz de negativas: cross-service, token inválido/revogado, TLS incorreto, fallback recusado |
| C05.OPS.01 | PENDENTE | Testes em ambiente-alvo de rotação, reload, Raft snapshot/restore, recovery key custody e auditoria |
| C05.GATE | BLOQUEADO | Aceite dos owners C05/A04/C03/C04, sem exposição de material secreto |

**Próxima unidade de documentação:** A06 — Account Access API.

[Referência técnica](REFERENCIA-TECNICA.md) · [Operação](OPERACAO.md) · [Capítulos](ESCOPO.md).
