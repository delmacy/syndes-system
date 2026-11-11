# AK-30.03 — Ativação e desativação auditadas de módulos

**Estado:** candidato versionado, não registrado no bootstrap nem implantado no Control DB operacional. Base: AK-10.01/02/03 e AK-30.01/02 já integradas no main em 2026-11-10.

## Regra central

Um módulo só pode receber ENABLED após uma instalação atestada com receipt correspondente à versão, entitlement em vigor, release globalmente aprovada e todas as dependências já ENABLED no **mesmo tenant**. O instalador físico deve executar VERIFY do ledger protegido e dos objetos do tenant **antes** de solicitar a transição de ENABLED no Control DB.

Não usar uma flag de frontend, mera aprovação do catálogo ou registro de entitlement como prova de instalação. **INSTALLED != ENABLED != autorização de usuário**. No runtime, membership, org/workspace, FGA e gate CoreKernel.executeModule continuam obrigatórios.

## Artefatos

1. infra/postgres/bootstrap/control-module-activation.schema (apenas candidato) cria role syndes_module_activator NOLOGIN e a função transacional public.transition_tenant_module_activation. A role do Host (syndes_core), do operador de entitlements (syndes_module_operator) e do atestador de instalação (syndes_module_installer) não têm EXECUTE nesta função; não há DML direto nas tabelas para essas roles.
2. apps/core-host/src/module-installer.ts passa a aceitar dependências INSTALLED ou ENABLED em PLAN/APPLY/VERIFY. Antes, um CRM habilitado bloqueava indevidamente a primeira instalação do Inbox; foi corrigido também no SQL de atestação control-module-attestation.schema. O campo de retorno de APPLY distingue REQUESTED, INSTALLED, ENABLED.
3. PgControlModuleActivator é um adapter de Control DB que exige conexão de operador técnico dedicada, não é provider Nest e não é conectado ao Core Host nem ao frontend. PgModuleInstaller.enable reexecuta VERIFY físico em tenant DB e depois invoca a função com receipt determinístico do manifest confiável. DISABLE pode ser solicitado mesmo com tenant suspenso ou ledger indisponível, mas exige identidade técnica privilegiada e receipt exato.
4. A função só aceita ENABLE quando a instalação atual é INSTALLED e DISABLE quando é ENABLED. Desativar retorna à condição INSTALLED **sem apagar** receipt, versão, esquema ou dados. Novos ciclos exigem nova chave UUID após outra alteração. Um replay antigo de disable/enable que não corresponde mais ao estado atual é recusado como 23514 (não reporta falso sucesso). Todas as mudanças geram evento append-only installation.enable ou installation.disable, ator, motivo, revisão e chave de idempotência.
5. Tenant suspenso só admite DISABLE; não admite ENABLE. Falha no catálogo, entitlement expirado, versão divergente, falta de dependência ou receipt inválido nega. Ingressos de tenant/Manager não podem enviar SQL nem escolher banco de dados.

## Sequência operacional futura

- **Pré-condições:** backup Control DB e bancos tenant com restauração testada; checksum das releases imutável e provenance validada; scripts de Control DB versionados e roles least-privilege revisadas; Keycloak (aud/azp/sub), OpenFGA e identidades de operadores auditadas; catálogo e entitlements vigentes.
- PLAN sem escrita → APPLY transacional (ledger tenant) → VERIFY físico → attestation INSTALLED no Control → comando de ENABLE por role restrita → cheque de estado do Control + gate Kernel/Host real. Em falha, reportar estado, sem inventar READY.
- Revogação: DISABLE imediato no Control, Kernel/Host/worker fail-closed em cada operação; por incident response a desativação não depende da disponibilidade do tenant DB. Não desinstala schemas ou apaga dados.
- Retomada: VERIFY físico e nova solicitação de ENABLE. Não reutilizar request id anterior como se criasse nova transição.
- As dependências são checadas por estado ENABLED; uma alteração posterior na dependência exige denegação dinâmica no Host, sem necessariamente desabilitar fisicamente todos os descendentes.

## Limites obrigatórios

- **Não implantado:** esta PR não cria role/endpoint/DDL nos bancos operacionais, não altera Docker/Tailscale/Keycloak/OpenBao, não liga nenhuma tela de botão, não migra controllers legados/worker e não ativa módulos reais. O novo port Kernel em Host só é aplicado a callers executeModule; rotas antigas ainda precisam ser migradas.
- **Admin técnico, não operador de UI:** actor e reason são claims fornecidos pelo processo privilegiado e **não** autenticação embutida no SQL. Até existir serviço de comando dedicado, com OIDC/RBAC/audit, a role NOLOGIN deve ficar sem grant a serviços HTTP ou usuários.
- O Control DB não consegue verificar fisicamente outro database dentro da transação do comando. A identidade do serviço técnico que invoca ENABLE deve ser isolada; o processo obrigatoriamente executa VERIFY antes. O SQL não é prova independente do ledger e não resolve o race entre bancos; reconciliador periódico é gate AK-30.04.
- A dependência pode ser desabilitada simultaneamente; ModuleAccessPort lê dependências e precisa negar o filho. A propagação de eventos/versões em workers ainda requer teste real. Não vender isto como revogação efetiva em todos os endpoints.
- Migrations de upgrade e downgrade, backups/restore e operacionalização das roles continuam AK-30.04/05. Criar migrations/version ledger do Control DB antes de ativar scripts aditivos e evitar reaplicação por ordem implícita de arquivos.

## Evidências e testes

apps/core-host/test/module-installer-pg17.test.mjs cria Control DB e dois bancos tenant em PG17 descartável e os remove **sem FORCE** após fechar conexões. Demonstra:

- CRM é instalado e atestado, habilitado e depois Inbox pode ser instalado mesmo com CRM já ENABLED; Inbox também habilitado.
- Roles separadas não executam comandos de ativação umas das outras e não escrevem tabelas diretamente.
- Idempotência, replay conflitante, replay antigo contra estado novo, dependência desabilitada, desabilitação de tenant suspenso, caso de ledger alterado, rollback de migration e ausência de acesso cross-tenant.
- Não existe instalação implícita e nenhum dado operacional de tenant foi modificado.

**Gate:** registrar CI real do SHA integrado e exigir E2E com Operator, Keycloak, FGA, worker e PostgreSQL operacional antes de declarar pronto.
