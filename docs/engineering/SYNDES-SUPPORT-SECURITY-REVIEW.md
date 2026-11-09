# Revisão de segurança — Syndes Support, PR #34

Estado: **análise técnica e testes automatizados executados; revisão independente por outro responsável ainda necessária**. Esta análise não é aprovação de produção nem substitui revisão humana. Data: 2026-11-09.

## Matriz de ameaças e provas

| Ameaça | Defesa em código | Evidência | Limitação |
|---|---|---|---|
| Tenant comercial selecionado por UUID na URL | `SupportService.run` exige `SYNDES_SUPPORT_TENANT_ID` e compara antes do pool | Support unit, HTTP e PG | UUID operacional errada na configuração exige controle humano e inventário do Control Plane |
| Migration Support aplicada em banco comercial | `support-migration-gate.sh` e instalador verificam tenant de destino | `support-migration-{gate,installer}.test.sh` no Host/Infra CI | Quem configura **a mesma UUID comercial em ambas variáveis** pode contornar por erro administrativo; política de duas pessoas e registro operacional obrigatórios |
| Token legítimo de outra aplicação na mesma audience | `ActorVerifier.verifyClient` verifica `azp=syndes-support-ui` após assinatura/issuer/aud | Keycloak real + navegador CI e HTTP unit | Não autoriza nenhum cliente OIDC alternativo; integrações futuras exigem identidade própria |
| Acesso sem membership FGA ou sem Keycloak | Kernel exige tenant membership + FGA por recurso/audience | HTTP 401/403, OpenFGA E2E, unit | Grants reais ainda não foram auditados |
| Leitura de Case de outra fila/solicitante | SQL verifica `tenant_id`, `kind`, requester ou membership de fila | PG real e navegador CI | Não usar papéis DB abrangentes para aplicação |
| Conta WhatsApp de cliente vinculada a ticket Syndes | Conta exclusiva configurada, vínculo Inbox/CRM/Organization/workspace | PG real negativo e E2E sintético | Conta real Syndes ainda não provisionada |
| Nota interna enviada ao canal | Registro `support_case_events`, sem escrita em Inbox/outbox; eventos filtrados para solicitante | PG negativo, histórico após reload Playwright | Proibir integração futura que reencaminhe notas sem novo review |
| Reescrita/exclusão de auditoria | Triggers de UPDATE/DELETE/TRUNCATE negam alteração nos eventos e audit de membership | PG real + backup/restore real na CI | Owner/superuser que pode alterar DDL ainda pode contornar triggers: ACL, monitoramento e backup são obrigatórios |
| Perda de dados / rollback não ensaiado | Dump/restore completo em bancos descartáveis, nota privada, eventos e índices SQL 002 | `modules/support/test/pg-backup-restore.mjs` | Não equivale a backup de dados reais ou teste de restauração em homologação operacional |
| Mistura Support / Platform Manager | Frontends e clients distintos; Support exige azp Support; PM somente Control DB | E2E Support; PR #33 tem API/role própria | Não há ainda contrato de agregados no PM; ver ADR separado |

## Escopo verificado

Implementação, testes unitários de serviço, SQL PostgreSQL 16 em CI, HTTP Nest real, Keycloak 26.8.1 real, OpenFGA 1.22.1 real, navegador Chromium e scripts de migração com dublês sem efeitos colaterais. Os serviços de CI são descartáveis. Os containers operacionais do DevServer01 **não** foram alterados.

## Riscos residuais bloqueadores

1. **Identidade operacional ausente:** os dois Core Hosts ativos do DevServer01 não tinham `SYNDES_SUPPORT_TENANT_ID` ou `SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID` preenchidos na inspeção somente leitura de 09/11/2026. Isso não comprova inexistência de tenant; apenas ausência de ativação do módulo no Host.
2. **Autorização de produção não verificada:** a PR #27 ainda é draft, PR #34 também. #31 proíbe ativação multi-org; nenhuma migração SQL 002 manual foi autorizada.
3. **Revisão independente necessária:** outro revisor deve inspecionar `modules/support/src/{service,controller}.ts`, SQL 001, `apps/core-host/src/adapters.ts`, instalador, fixtures e as provas GitHub. A análise do próprio autor não atende independência.
4. **Privacidade e retenção:** política aprovada para dados de conversas/contatos, notas e prazo de retenção ainda não demonstrada. Não habilitar anexos/exportação.
5. **Publicação real pendente:** TLS, DNS/origem separada, cliente `syndes-support-ui` em Keycloak operacional, grants FGA/filas auditados, testes de autenticação reais e conta WhatsApp dedicada.
6. **Backup real pendente:** a restauração CI é apenas sintética. Exigir backup criptografado do tenant operacional com ensaio de restore e plano de incidente antes de go-live.

## Critério para assinatura de revisão

O revisor externo ao conjunto de mudanças confirma: código e SQL sem escalada entre tenants, checagem `azp`, grants em menor privilégio, triggers/ACL, CI no HEAD aprovado, release imutável, script de migração sem path arbitrário, Gate #31 intacto. Registrar parecer com commit, data, risco residual e decisão na discussão da PR #34.

## Fechamento adicional: imagem de migration imutável
O instalador privilegiado `infra/postgres/bootstrap/migrate-modules-tenant.sh` agora **rejeita** imagens que não estejam referenciadas por `@sha256:<64 hex>`. A proteção evita que a migração execute SQL proveniente de uma tag mutável depois do review; não comprova que um digest arbitrário está aprovado. O teste `tests/platform/support-migration-installer.test.sh` exige falha para tag mutável e segue exercitando o instalador verdadeiro com `docker` e `jq` simulados, sem efeitos de SQL. O release continua exigindo digest aprovado por processo humano.
