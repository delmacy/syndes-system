/**
 * INBOX-06-R2-F1 — Teardown seguro do tenant/conversa fake sintético.
 *
 * Remove somente os registros sintéticos criados pelo seed (ids fixos conhecidos).
 * Nunca toca em dados reais nem em tenants de produção. Idempotente.
 *
 * Uso:
 *   node scripts/teardown-inbox-disposable.mjs
 */

import { Pool } from 'pg';

const tenantId = 'ae2e174a-ef1c-496f-bf34-80727a87e799';
let TENANT_DATABASE_URL = process.env.TENANT_DATABASE_URL;
if (!TENANT_DATABASE_URL && process.env.TENANT_ADMIN_DATABASE_URL) {
  const parsed = new URL(process.env.TENANT_ADMIN_DATABASE_URL);
  parsed.pathname = `/sdb_${tenantId.replaceAll('-', '')}`;
  TENANT_DATABASE_URL = parsed.toString();
}
if (!TENANT_DATABASE_URL) {
  console.error(JSON.stringify({
    type: 'teardown.error',
    code: 'missing_tenant_database_url',
    message: 'TENANT_DATABASE_URL é obrigatória para teardown.',
  }));
  process.exit(1);
}

const SYNTHETIC_CONVERSATION_ID = '00000000-0000-0000-0000-000000000005';
const SYNTHETIC_INBOUND_MSG_ID = '00000000-0000-0000-0000-000000000006';

const pool = new Pool({ connectionString: TENANT_DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM inbox_messages WHERE id = $1`,
      [SYNTHETIC_INBOUND_MSG_ID],
    );
    await client.query(
      `DELETE FROM inbox_conversations WHERE id = $1`,
      [SYNTHETIC_CONVERSATION_ID],
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({
      type: 'teardown.ok',
      conversationId: SYNTHETIC_CONVERSATION_ID,
      message: 'Registros sintéticos removidos com sucesso.',
    }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({
      type: 'teardown.error',
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
    type: 'teardown.fatal',
    message: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
