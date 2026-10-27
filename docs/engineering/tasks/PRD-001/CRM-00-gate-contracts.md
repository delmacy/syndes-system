# CRM-00 — Fechar Product Gate e contratos

- **Módulo/gate:** Core CRM PRD-001 / Sprint 0 Gate 0.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / ACEITA; Product Gate concluído após prova PostgreSQL 16 do CRM-01.
- **Responsável:** Codex coordenador; não delegar decisão de produto/segurança a agente implementador.
- **Issue/branch/commit/PR:** ainda não existem; operação externa não incluída.

## Objetivo e contexto

Transformar as decisões técnicas ainda abertas no handoff em contratos versionados que desbloqueiem endpoints e UI autenticados sem expor tenants. A pessoa usuária selecionou Keycloak como serviço de identidade OIDC com MFA/SSO. MFA obrigatória para admins da plataforma e a matriz `tenant_admin`/`tenant_member` foram confirmadas; membros ficam sob política operacional configurável do Keycloak. SSO interno do Keycloak entra no MVP; federação externa por tenant fica fora do escopo por regra de `modules/platform-core/AGENTS.md`.

## Incluído

- Congelar a integração OIDC Next.js ↔ NestJS ↔ Keycloak: issuer, audience, claims mínimos, validação de assinatura via JWKS, subject→AuthenticatedActor, cookie/session, logout e cliente/protocolo; usar bibliotecas OIDC/JWT mantidas, sem implementar criptografia/protocolo manualmente.
- Definir enforcement de MFA no Keycloak: obrigatório para Platform Admin; membros seguem a política do realm administrada operacionalmente, sem configuração por tenant no MVP. SSO do realm é suportado no MVP; federação externa SAML/OIDC por tenant é pós-MVP.
- Congelar contratos mínimos `AuthenticatedActor`, `TenantContext`, membership, papel e autorização; separar Platform Admin de tenant roles.
- Congelar o escopo fixo de atendimento por membership: `cpf` cobre Persons sem vínculo PJ; `pj` cobre Organizations PJ e suas Persons de contato vinculadas; `both` cobre ambos. `tenant_admin` configura esse escopo para membros no mesmo CRM; aplicação server-side em todas as operações, sem policy engine genérico.
- Definir versionamento/envelopes de API, erros e limites CSV requeridos pelas primeiras tasks.
- Definir provisioning states/transições/retry e estratégia operacional de criação de database e migrations tenant.
- Fechar semântica mínima dos requisitos aprovados que afetam schema: Employee, alvos de Tag/Note, eventos de Timeline e atomicidade/partial success do CSV; documentar recomendação ou escalar escolha humana não inferível.
- Registrar decisão, alternativa rejeitada e impacto em `PRD-001-CORE-CRM-TECH-HANDOFF.md`; manter arquitetura mínima.

## Excluído

- Implementar auth, endpoints, UI, provider externo, RBAC genérico ou policy language.
- Abrir Issues/Projects, branches, PRs ou alterar configuração de conta.

## Dependências e arquivos

- Entradas: spec Core CRM, sprint plan, root `AGENTS.md`, `modules/core-crm/AGENTS.md`, `modules/platform-core/AGENTS.md`.
- Permitidos: handoff técnico e spec/sprint/task docs correspondentes.
- Proibidos: código de `apps/**`, secret/config de harness, escopo de módulos futuros.
- Contratos consumidos: Keycloak OIDC; produz actor, tenant context, sessão, API/errors/CSV e provisionamento.

## Critérios de aceite e validação

- A decisão de Keycloak/OIDC permanece registrada; cada decisão de segurança contém comportamento verificável e nenhum tenant é selecionável pelo cliente.
- Manager não ganha acesso ao conteúdo CRM.
- Toda questão que exigir escolha humana está destacada com opções, recomendação, impacto e bloqueio explícito; não inventar aprovação. MFA de Platform Admin e escopo de federação já estão decididos.
- `CRM-02` a `CRM-10` podem apontar a contratos e regras com nomes/semântica estáveis.
- Fazer revisão cruzada contra os dois AGENTS de módulo e atualizar ordem/dependências afetadas.
- Testes: não aplicável a esta task documental; `git diff --check` e revisão de links/conflitos obrigatórios.

## Evidência, risco e encerramento

- Registrar docs alterados e decisões pendentes, sem credentials ou dados de usuário.
- Confirmado pelo usuário: Keycloak OIDC; MFA Platform Admin obrigatória; MFA de tenant sob política do realm; Keycloak realm SSO no MVP e federação externa por tenant pós-MVP; papéis tenant_admin/tenant_member com archive/export negados para member.
- Codex registrou contratos propostos para OIDC/session/JWKS, actor/tenant context, API/Problem Details, CSV, timeline/tag/note e provisioning no handoff. Rever contra o Product Spec e os dois AGENTS de módulo.
- Semântica Employee, account link, customer scopes e matriz de autorização estão confirmados e registrados no handoff. Gate 0 ACEITO após API e Repository Integrity CI verdes; Sprint 1 liberada conforme dependências das tarefas.
- Escopo de cliente aprovado pelo usuário: atendimento PJ inclui a Organization e suas Persons de contato vinculadas; atendimento CPF inclui Persons sem vínculo PJ.
- Risco: credenciais e database routing sem secret store/runtime ainda medidos. Escalar somente a escolha ambiental não inferível; sem valores de configuração, não inventar secrets ou limites.
- Revisão cruzada concluída contra root `AGENTS.md`, `modules/core-crm/AGENTS.md` e `modules/platform-core/AGENTS.md`; whitespace e links locais verificados.
- Evidência final: commit `075e329`; API run `40507834957` passou (inclui PostgreSQL 16); Repository Integrity run `40507834659` passou.
- Próximo responsável: OpenCode Free inicia CRM-02; CRM-03 segue após CRM-02.
