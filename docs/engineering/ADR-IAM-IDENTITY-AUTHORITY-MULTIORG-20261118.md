# ADR — Autoridade única de credenciais e hierarquia multi-organização Syndes

**Data:** 2026-11-18  
**Estado:** contrato arquitetural aprovado para implementação incremental; cutover operacional NÃO autorizado.  
**Classificação:** BLOCKER IAM + isolamento de dados. `PRODUCTION_GATE=BLOCKED`.

## Decisão

1. **Keycloak é o único Identity Provider e credential engine:** cadastro canônico de pessoas/contas técnicas, autenticação, senha, MFA, sessões, tokens, issuer e memberships de Keycloak Organizations. `sub` imutável identifica o principal. Não persistir passwords, hashes de senha, refresh tokens ou contas autenticáveis em OpenFGA/SQL.
2. **OpenFGA é um motor de autorização por recurso/relação, NÃO um diretório de identidades.** Tuples `user:<Keycloak-sub>` / `service:<Keycloak-service-id>` são referências; `grantee`/capability só decide relação exata, não comprova existência, login, tenant membership ou Organizations membership. O Syndes NÃO replica a mesma concessão como grant efetivo de Keycloak UMA e OpenFGA; o candidato UMA continua shadow até gate específico. FGA `service/event_delivery` permanece separado de grants humanos.
3. **Syndes Control** decide tenant/DB confiável, entitlement de módulo, vínculo imutável e auditado `(realm, keycloak_organization_id) ↔ (tenant_id, platform_organization_id)`; não oferece uma segunda credencial.
4. **Tenant PostgreSQL** registra estrutura operacional (organization, workspace, funil, conversa) e memberships operacionais/roles locais por escopo com integridade SQL, revogação tenant-first e epoch. Esses vínculos são necessários para transações, mas **não substituem nem emitem** membership Keycloak. A autorização exige simultaneamente Keycloak Organization membership ATUAL, Control, contexto SQL e grant FGA específico.
5. **Syndes Core** é o único ponto de enforcement na aplicação. Nenhum sistema isolado fornece ALLOW final; falha de qualquer fonte = deny. Nunca permitir JWT de Platform Manager no contexto de cliente automaticamente.

## Cardinalidade e modelo de ownership (alvo inequívoco)

```text
Tenant (1 conta contratante / 1 PostgreSQL database)
├─ Organization A (Keycloak Organization A ↔ Platform Organization A)
│  ├─ Workspace A1
│  │  ├─ Funnel A1.1
│  │  └─ Funnel A1.2
│  └─ Workspace A2
│     ├─ Funnel A2.1
│     └─ Funnel A2.2
└─ Organization B (Keycloak Organization B ↔ Platform Organization B)
   ├─ Workspace B1
   │  ├─ Funnel B1.1
   │  └─ Funnel B1.2
   └─ Workspace B2
      └─ Funnel B2.1
```

| Relação | Cardinalidade | Ownership, prova no código |
|---|---|---|
| Tenant → Organization | 1:N | `platform_organizations(tenant_id,id)`; mesmo DB, isolamento lógico explícito |
| Organization → Workspace | 1:N | `platform_workspaces(tenant_id,organization_id,id)`, FK composta; nenhuma workspace sem organização |
| Workspace → Funnel | 1:N | `service.service_funnels(tenant_id,organization_id,workspace_id,id)`, FK composta; múltiplos funis por workspace |
| Funnel → Stages | 1:2..8 no MVP | `service.service_funnel_stages` com FK completa e uma etapa terminal |
| Actor → Organizations | N:N mediante membership explícita | Keycloak Organizations atual + contexto SQL ativo, sem acesso implícito a outras organizações |
| Actor → Workspaces | N:N mediante membership explícita | `platform_workspace_memberships` e membership da organização pai |
| User/Service → Capability por recurso | N:N | OpenFGA; objeto inclui tenant/org/workspace/capability e funnel quando aplicável |

**Resolução da divergência documental:** uma ADR proposta de 2026-11-08 mencionava exposição futura de uma mesma definição de funil em múltiplos workspaces (N:N). **O contrato implementado do módulo Service v0.3.0 é 1 workspace → N funis, cada funil pertencendo a exatamente 1 workspace.** Não introduzir `workspace_funnels` ou reutilização cross-workspace nesta etapa. Compartilhamento de definição exige produto/migration/PRD próprios.

Uma pessoa pode participar de duas organizações do mesmo tenant (ou tenants distintos), mas cada operação seleciona **um** tenant, **uma** organização e **um** workspace, e, para operação de funil, **um** funnelId. A seleção é apenas chave de busca: memberships Keycloak e SQL, ownership, módulo e FGA são revalidados. Trocar o identificador na requisição nunca concede acesso.

## Situação existente e bloqueio de cutover

- `001_account_hierarchy.sql` **já suporta** N organizações e N workspaces estruturalmente (FKs compostas).
- `service-management/sql/001_service_funnels.sql` **já suporta** N funis por workspace, sem permitir que funil de outro workspace passe nas FKs.
- `002_legacy_single_context_gate.sql` instala índices únicos `platform_legacy_single_organization` e `platform_legacy_single_workspace`, de propósito: enquanto consultas legadas de CRM, Inbox, WhatsApp, SSE, exports, search ou workers forem tenant-wide, uma segunda organização pode expor dados.
- `resolveSelectedOperationalScope` permite multicontexto **somente** quando ambos os índices desaparecem E uma flag de servidor explícita está ativa; índice ausente isoladamente falha fechado.
- `008_iam07d_revoke_first_candidate.sql` **exige os índices SQL002** e é incompatível com corte multi-org. Seu preflight e o protocolo de fence precisam ser migrados/testados antes de remover SQL002. Não remover índices para obter teste verde e não alterar o realm `syndes` nesta PR.
- Um vínculo Keycloak ↔ Platform Organization continua 1:1 **por organização**, mas não 1:1 por tenant. Duas orgs no mesmo tenant têm dois vínculos separados e duas memberships validadas.

## Protocolo para habilitar a cardinalidade (ainda BLOQUEADO)

1. Inventariar todos os consumidores tenant-wide (CRM, Inbox, WhatsApp, Service, search, export, SSE e workers), proteger read/write com `tenant+org+workspace` e comprovar A/B negativos.
2. Introduzir e testar uma revisão do fence IAM-07D e do catálogo de alvos FGA que funcione tanto antes quanto depois do cutover sem perder monotonicidade, atomicidade e locks.
3. Provar no PG17 descartável duas organizações no **mesmo tenant database**, duas workspaces por organização e dois funis por workspace, com memberships A/B, grants exatos e denials cross-scope. Aplicar manualmente migrations Service como candidatos apenas no laboratório.
4. Testar Keycloak Organizations real com duas Organizations por tenant e links auditados distintos, revogação de uma membership sem remover a outra, e usuário de múltiplas orgs sem ampliação de autorização.
5. Verificar restore **de staging**, plano reversível de dados, ACLs mínimas, SSE multi-host, migração de ownership legado sem defaults implícitos, carga e rollback. Um rollback que recrie os índices SQL002 após existirem múltiplas orgs **não é possível sem tratar esses dados**; exigir plano de rollback de aplicação/feature e recuperação de backup.
6. Somente com Product Gate formal, migração operador-only no GitHub CI/CD remove **ambos** índices SQL002 numa transação controlada, com Host SHA aprovado, flag server-side e smoke checks. Sem deploy manual.

## Consequências arquiteturais

Não criar frontend novo, outro banco por organização, credenciais FGA, grants duplicados Keycloak UMA, usuário SQL com senha, endpoints de criação multi-org antes dos gates, nem novos funis artificiais. Administrar permissões pela futura API do Syndes de forma centralizada, usando credencial Keycloak e grants OpenFGA, sem dar tokens administrativos ao browser. `IAM-09` permanece BLOQUEADO até prova operacional; esta ADR não equivale a teste E2E nem habilitação de multi-org.
