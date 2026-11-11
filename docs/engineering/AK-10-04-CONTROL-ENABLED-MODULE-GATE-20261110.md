# AK-10.04 — Gate de módulo no Core Host (candidato, integração parcial)

**Data:** 2026-11-10. **Estado:** adapter efetivo de autorização no CoreKernel **somente para executeModule**, sem migração dos handlers antigos. Complementa ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110 e AK-10.01/02/03/30.

## Contrato implementado

A classe PgEffectiveModuleAccess implementa ModuleAccessPort do Kernel e utiliza o snapshot PgModuleLifecycle do **Control DB** para um tenant ativo.

O gate concede somente quando TODAS as condições forem verdadeiras:

1. Actor autenticado por host, tenant UUID válido e id de módulo sintaticamente seguro. Kernel executa membership do tenant e autorização OpenFGA antes do port, pela sequência de CoreKernel.executeModule.
2. Release do módulo deve existir no build confiável e coincidir com catálogo Control DB (id, schema, version, dependências aprovadas).
3. Entitlement do módulo deve estar **granted** com validade atual (relógio PostgreSQL), sem suspensão/revogação.
4. Registro de instalação deve estar **enabled** (não somente requested/installed), com targetVersion e installedVersion iguais à versão do build e receipt de verificação não vazio e coerente.
5. **Todos os módulos dependentes** devem cumprir igualmente 2–4 para o mesmo tenant. Estado de B jamais supre dependências de A.
6. Query falha, catálogo incompleto, dados inválidos, versão errada, ciclo, dependência indisponível e Control DB fora do ar resultam em DENY. Não existe fallback permissivo.

No composition root do Core Host, CoreKernel.moduleAccess recebe a implementação acima, sem expor API administrativa, grants ou DDL. A integração **não toca** em Mainline Actions, SQL operacional, portas ou frontend.

## O que NÃO está implementado ainda

- Handlers legados de CRM, Inbox, WhatsApp, Support e jobs ainda utilizam CoreKernel.execute ou caminhos específicos: **não são bloqueados por este gate**. Ativar o gate nas rotas antes de migrar catálogos/entitlements/ledger e definir módulo de cada rota quebraria uso real; isso exige plano de corte e rollback por tenant.
- AK-30 tem attestation do instalador apenas até INSTALLED. A transição legítima para ENABLED, com autorização de operador auditada, ainda precisa de serviço seguro; fixtures de teste marcam enabled artificialmente em PostgreSQL descartável para cobrir a lógica.
- Host confia na atestação protegida do Control DB, **não consulta o ledger físico por request**. Drift entre tenant DB e Control DB deve ser reconciliado por serviço técnico AK-30.03–05 antes do Product Gate. Nenhuma consulta do frontend pode substituir a prova física.
- Não há sessão de Manager válida no Host, e owner global continua sem acesso a dados operacionais por padrão. As redes e clientes OIDC permanecem segregados.

## Evidências

- Testes unitários de grant, expiry, suspensão, state installed vs enabled, version drift, actor malformado, ciclo, duplicate, dependency missing, erro de Control DB.
- PostgreSQL 17 descartável: três tenants registrados, A CRM/Inbox enabled, B CRM installed e Inbox suspended, C suspenso e D desconhecido; cenários de dependência revogada, expirada, desabilitada, ausência de receipt e deapproval do catálogo. Nenhum banco real acessado.
- Regredir Core Host, Kernel e módulos contra os contratos existentes. CI do SHA integrado é obrigatória antes do merge.

## Sequência de gates

1. Finalizar AK-30.03–05: privilégio de DDL por schema, assinatura/release, ledger verificável, inventário real, E2E e restore/rollback.
2. Criar transição auditada INSTALLED → ENABLED apenas pelo operador técnico autenticado, sem manipulação direta de tabelas.
3. Identificar/migrar todos os controllers, handlers assíncronos e workers para executeModule (ou middleware equivalente testado), incluindo negação cross-tenant/FGA e roles antigas.
4. Control DB operacional somente após inventário, backup, gates de SQL e aprovação explícita. Fazer rollout gradual por tenant, monitorar deny e preservar rollback.
5. Marcar AK-10.04 DONE somente depois que API+jobs antigos estiverem efetivamente protegidos em produção.
