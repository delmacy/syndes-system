# ADR — Dispatcher e consumidores idempotentes (2026-11-11)

**Fase:** PR2 candidata. Código isolado em worktree; produção permanece desligada.

## Semântica

- Entrega **at least once** com efeitos **idempotentes**, não exactly once.
- Routing separa a produção do evento do cadastro das entregas a consumidores. O roteador usa `FOR UPDATE SKIP LOCKED` na outbox e cria entrega única por `tenant_id, event_id, consumer_id`.
- Claim usa `FOR UPDATE SKIP LOCKED`, lease de 30 segundos, `lease_owner` UUID e limite de 8 tentativas. Falhas transitórias têm backoff 5/10/20/40/... segundos, limitado a 3600 segundos.
- Consumidor executa efeito de domínio, registra `consumer_inbox` e confirma `event_deliveries` **na mesma transação PostgreSQL fixada**. Falha em qualquer ponto provoca rollback integral. Repetições verificam primeiro o inbox.
- Evento com versão/tipo/payload não suportado muda para `routing_state='unsupported'` e permanece disponível à revisão, sem criar efeitos.
- Erros de negócio permanentes e negativas explícitas de autorização vão a `dead`, sem incluir conteúdo de mensagem em logs/registro de erros. Falhas transitórias do port de autorização e handlers temporariamente ausentes ficam em `suspended` com recuperação; não são interpretadas como negativas definitivas.
- Leases expirados podem ser reclamados por outro worker; esgotamento de tentativas termina em `dead`.

## Fronteiras e autorização

- O dispatcher recebe `TenantPgProvider`, assinaturas confiáveis estáticas e um `EventWorkerAuthorization` injetado pelo Host. Nunca aceita registro de consumidor do payload ou requisições HTTP.
- A identidade técnica é `Actor {kind:'service', id: <identidade confiável>}`; não criar ou simular JWT de usuário.
- Antes de qualquer efeito, o port de autorização deve verificar tenant, Platform Organization, Workspace, módulo consumidor e seu estado ENABLED. A execução falha fechada se não houver autorização.
- Sem provisionamento seguro de Control DB, OpenFGA e módulos ENABLED, **não iniciar dispatcher periódico no Host**.
- Uma alteração de estado do módulo enquanto uma transação já foi admitida é um limite de consistência entre databases; a integração operacional exige política de gate e revalidação documentadas.
- O atendimento WhatsApp textual legado permanece ativo de forma independente; nenhum handler de produção foi registrado nesta fase.

## Recuperação, retenção e observabilidade

- Métricas mínimas para worker futuro: backlog pending/routed/unsupported, deliveries por state, leases vencidos, retries por consumidor, oldest pending age.
- Recuperação automática apenas por claim de lease expirado ou `next_attempt_at` atingido. Reprocessar `dead` e `unsupported` requer procedimento autorizado e rastreável.
- Não expurgar eventos com entregas pendentes, retry, suspended, processing ou dead sem análise, backup/restore e política de retenção aprovada.
- Não ativar o job sobre `syndes_control`; cada tenant usa seu próprio database e seu registro confiável.

## Evidências e lacunas

Testes PG17 descartáveis cobrem dois consumidores independentes, idempotência após reentrega, falha antes/durante/depois do efeito, falha de confirmação, module suspension, recuperação de lease após reinício, dispatchers concorrentes, isolamento de tenant e evento não suportado.

**Ainda não cobre operação contínua autorizada:** scheduler, service principal provisionado com FGA, integração real de handlers WhatsApp/Inbox/CRM, automação de purga, backup/restore operacional e homologação. Esses gates são separados.
