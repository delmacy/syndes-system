# Gate final de release operacional — Syndes Support

**Não autorizado para produção.** Este documento é um checklist verificável e não é um script de deploy. Nenhum item operacional pode ser inferido de CI verde.

## Pré-flight — condições cumulativas

- [ ] PR #27 integrada pela cadeia de dependências e revisada; PR #34 revisada independentemente, sem checks vermelhos, aprovada pela autoridade de release.
- [ ] Product Gate confirma tenant próprio Syndes no Control DB, com ID registrado em fonte de verdade externa à URL e **sem confundir com tenant comercial**.
- [ ] Migrar módulos dependentes no tenant operacional conforme contrato; `TENANT_ID` e `SYNDES_SUPPORT_TENANT_ID` devem coincidir com a identidade Syndes aprovada. Não modificar manualmente SQL 002 e manter `SYNDES_MULTI_ORG_ENABLED=false`.
- [ ] Conta Whatsmeow **exclusiva** de suporte Syndes provisionada, proprietária e rota de Inbox/CRM verificadas sem dados de cliente cruzados.
- [ ] Keycloak: cliente OIDC público `syndes-support-ui`, somente authorization code + PKCE S256, `azp` e audience compatíveis, callback exata da origem HTTPS isolada.
- [ ] FGA mínimo: somente identidades autorizadas para `support:cases:internal`/`support:cases:external`, `inbox:conversations` e `crm:people` quando pertinentes; grants explícitos e revisados. Filas administradas por operação DBA com auditoria.
- [ ] Segregação de bundles, origens, cookie/sessão, redes e acessos DB comprovada; sem acesso de token do Platform Manager às rotas Support.
- [ ] Backup criptografado **real** do tenant Syndes antes da migration, hash e localização protegida registrados fora do Git. Ensaio de restauração em banco isolado, verificação de auditoria e duração operacional documentada.
- [ ] Imagens Docker por digest imutável, mudança aprovada e janela definida; plano para reverter imagem, frontend e proxy **sem DROP/TRUNCATE**.
- [ ] Smoke real com perfis autorizados: 401 anônimo, token de outro azp rejeitado, 403 sem fila/FGA, negar tenant comercial, chamados internos, nota privada, fluxo externo com conta Syndes, falha FGA/DB fail-closed.
- [ ] Revisão de retenção/consentimento e política de acesso de operadores a informações sensíveis. Observabilidade sem payloads, números, tokens ou dados pessoais.
- [ ] Aceite final assinado por responsável de produto, engenharia/segurança e operador da implantação, referenciando commit/digest e evidências.

## Evidência de CI descartável, não aprovação operacional

Reprodução do cenário técnico: `modules/support/test/pg-backup-restore.mjs` (dump real, restore completo e rollback em PostgreSQL descartável), `apps/support-web/e2e/support.spec.mjs` (Keycloak, OpenFGA, PostgreSQL, Chromium) e `tests/platform/support-migration-{gate,installer}.test.sh` (instalador com efeitos simulados). Verificar checks no HEAD e registrar links na PR. Nenhum desses ensaios utiliza tenant de produção, telefone real ou imagem implantada.

## Procedimento de rollback operacional

Preservar volumes e audit logs. Suspender rota/entrada HTTPS da Central; devolver imagem Core Host e UI à versão prévia por digest aprovado; manter `SYNDES_MULTI_ORG_ENABLED=false` e os dois índices SQL 002; confirmar 401/403 e saúde da aplicação anterior. Em caso de corrupção de dados, **não** restaurar por conta própria: DBA usa backup validado com aprovação e análise de ponto de recuperação. Anotar motivo, período, hashes e sign-off no ticket de mudança.

## Registros obrigatórios que ainda não existem

Identidade do tenant operacional (out-of-band, não publicar UUID aqui), conta WhatsApp homologada, lista de grants e responsáveis, hashes dos snapshots, autorização da janela, imagem/digest, evidência do restore real, parecer independente, aprovação de ativação e resultado dos smoke tests reais. **Sem qualquer um deles, o estado é BLOCKED, não DEPLOYED.**

## Imagem imutável — pré-condição técnica
Na WBS de release, **tag de Docker não é identidade suficiente**. A função de instalação testa e recusa `SYNDES_CORE_HOST_IMAGE` diferente de uma referência `@sha256:<hex64>`. Registrar digest **do artefato revisado e aprovado** no ticket de release; teste negativo de tag e teste com digest sintético devem passar no Core Host/Infra CI. Digest não dispensa revisão da origem nem conferência das dependências de supply chain.
