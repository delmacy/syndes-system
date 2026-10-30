/**
 * INBOX-06-R2-F1 — Seed de tenant e conversa fake sintética para jornada Playwright.
 *
 * Ambiente local descartável. NÃO usa dados reais, NÃO conecta provider WhatsApp/email
 * real, NÃO altera auth global nem API. Todos os valores são sintéticos e gravados
 * apenas em memória/arquivos temporários do ambiente de execução.
 *
 * Uso:
 *   node scripts/seed-inbox-disposable.mjs
 *
 * Requer: PostgreSQL disponível na porta do TENANT_DATABASE_URL (ou 5432 por padrão)
 *         e variáveis de ambiente do Control Plane configuradas.
 */

import { Pool } from 'pg';

const tenantId = 'ae2e174a-ef1c-496f-bf34-80727a87e799';
const tenantDatabaseName = `sdb_${tenantId.replaceAll('-', '')}`;
const adminUrl = process.env.TENANT_ADMIN_DATABASE_URL;
let derivedTenantUrl = process.env.TENANT_DATABASE_URL;
if (!derivedTenantUrl && adminUrl) {
  const parsed = new URL(adminUrl);
  parsed.pathname = `/${tenantDatabaseName}`;
  derivedTenantUrl = parsed.toString();
}
const TENANT_DATABASE_URL = derivedTenantUrl;
if (!TENANT_DATABASE_URL) {
  console.error(JSON.stringify({
    type: 'seed.error',
    code: 'missing_tenant_database_url',
    message: 'TENANT_DATABASE_URL é obrigatória para seed do tenant descartável.',
  }));
  process.exit(1);
}

// IDs sintéticos fixos para a jornada (não são dados reais de produção)
const SYNTHETIC_TENANT_ID = tenantId;
const SYNTHETIC_CONVERSATION_ID = '00000000-0000-0000-0000-000000000005';
const SYNTHETIC_INBOUND_MSG_ID = '00000000-0000-0000-0000-000000000006';
const SYNTHETIC_ASSIGNEE_ACTOR_ID = process.env.SYNTHETIC_ASSIGNEE_ACTOR_ID || null;

const pool = new Pool({ connectionString: TENANT_DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Garante conversa fake (idempotente via INSERT ... ON CONFLICT DO NOTHING)
    await client.query(
      `INSERT INTO inbox_conversations (id, person_id, organization_id, status, channel, created_at, updated_at)
       VALUES ($1, NULL, NULL, 'open', 'whatsapp', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [SYNTHETIC_CONVERSATION_ID],
    );
    if (SYNTHETIC_ASSIGNEE_ACTOR_ID) {
      await client.query(
        `UPDATE inbox_conversations SET assignee_actor_id = $2 WHERE id = $1`,
        [SYNTHETIC_CONVERSATION_ID, SYNTHETIC_ASSIGNEE_ACTOR_ID],
      );
    }

    // Garante mensagem inbound fake (idempotente por external_id único)
    await client.query(
      `INSERT INTO inbox_messages (id, conversation_id, direction, body, author_external_id, delivery_status, source_channel, external_id, idempotency_key, created_at)
       SELECT $1, $2, 'inbound', 'Mensagem sintética de aceitação do Inbox', 'ext-synthetic-inbound-001', 'dispatched', 'whatsapp', 'ext-synthetic-inbound-001', 'seed-synthetic-inbound-001', now()
       WHERE NOT EXISTS (SELECT 1 FROM inbox_messages WHERE id = $1)`,
      [SYNTHETIC_INBOUND_MSG_ID, SYNTHETIC_CONVERSATION_ID],
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({
      type: 'seed.ok',
      tenantId: SYNTHETIC_TENANT_ID,
      conversationId: SYNTHETIC_CONVERSATION_ID,
      messageId: SYNTHETIC_INBOUND_MSG_ID,
      message: 'Tenant e conversa fake sintéticos provisionados.',
    }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({
      type: 'seed.error',
      code: error.code ?? 'unknown',
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    type: 'seed.fatal',
    message: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
