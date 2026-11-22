import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { AccessDeniedError, PINNED_TENANT_TRANSACTION } from "@syndes/core-kernel";
import { WhatsAppReplyQueue } from "../../../modules/whatsapp/dist/outbound-reply.js";
import { WhatsAppHistoryCommandWorker } from "../../../modules/whatsapp/dist/history-command-worker.js";

const url = process.env.SYNDES_IAM04_PG_URL;
const disposable = (() => {
  try {
    const endpoint = new URL(url);
    return process.env.SYNDES_IAM04_DISPOSABLE_PG === "IAM04B_PG17_ONLY" &&
      endpoint.protocol === "postgresql:" && endpoint.hostname === "127.0.0.1" &&
      endpoint.port === "32779" && endpoint.pathname === "/postgres" &&
      endpoint.username === "postgres" && endpoint.password === "ci-only-disposable-iam-ci";
  } catch {
    return false;
  }
})();
test("history requests audit once, dispatch once, and never resend after uncertain acknowledgement", { skip: !url || !disposable }, async () => {
  const pool = new pg.Pool({ connectionString: url });
  const schema = "history_cmd_" + randomUUID().replaceAll("-", "");
  const [tenantId, organizationId, workspaceId, conversationId, accountId, principalId] =
    Array.from({ length: 6 }, () => randomUUID());
  const scope = { tenantId, organizationId, workspaceId };
  const context = { ...scope, actor: { id: principalId }, scopeWriteAllowed: true };
  const transaction = async (task) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path TO " + schema);
      const result = await task({
        tenantId,
        [PINNED_TENANT_TRANSACTION]: true,
        query: (sql, args) => client.query(sql, args),
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  const query = (sql, args) => transaction(tx => tx.query(sql, args));
  const db = { tenantId, query };
  const tenants = { resolve: async () => db };
  const queue = new WhatsAppReplyQueue(tenants);
  let epoch = "1";
  const authorization = {
    async executeHistoryCommand(selected, actor, acceptedEpoch, effect) {
      assert.deepEqual(selected, scope);
      assert.equal(actor, principalId);
      if (epoch !== acceptedEpoch) throw new AccessDeniedError();
      return transaction(effect);
    },
  };
  let calls = 0;
  const worker = new WhatsAppHistoryCommandWorker(tenants, authorization, {
    async requestHistory(tenant, account, request) {
      assert.equal(tenant, tenantId);
      assert.equal(account, accountId);
      assert.equal(request.chatExternalId, "stage@lid");
      assert.equal(request.count, 50);
      assert.equal((await query("SELECT count(*)::int AS n FROM whatsapp_history_commands WHERE state='attempted'")).rows[0].n, 1);
      calls++;
      if (calls === 2) throw Error("Acknowledgement lost");
      return { requested: true };
    },
  });
  const enqueue = () => transaction(tx => queue.enqueueHistoryPinned(context, conversationId, tx));
  const addAnchor = (id, time) => query(`
    INSERT INTO whatsapp_inbound_events (tenant_id,account_id,event_type,processed_at,payload)
    VALUES ($1,$2,'whatsapp.message.received',now(),$3)
  `, [tenantId, accountId, { message: { senderExternalId: "stage@lid", externalMessageId: id, occurredAt: time } }]);
  try {
    assert.match((await pool.query("SHOW server_version")).rows[0].server_version, /^17\./);
    await pool.query("CREATE SCHEMA " + schema);
    await query(`
      CREATE TABLE inbox_conversations (tenant_id uuid,id uuid,channel text,platform_organization_id uuid,platform_current_workspace_id uuid);
      CREATE TABLE whatsapp_conversation_routes (tenant_id uuid,conversation_id uuid,account_id uuid,recipient_external_id text,phone_e164 text);
      CREATE TABLE whatsapp_accounts (tenant_id uuid,id uuid,service_enabled boolean,platform_organization_id uuid);
      CREATE TABLE whatsapp_inbound_events (id bigint GENERATED ALWAYS AS IDENTITY,tenant_id uuid,account_id uuid,event_type text,processed_at timestamptz,failed_at timestamptz,payload jsonb);
      CREATE TABLE platform_workspaces (tenant_id uuid,organization_id uuid,id uuid,status text);
      CREATE TABLE platform_organizations (tenant_id uuid,id uuid,status text);
      CREATE TABLE platform_iam_capability_fences (tenant_id uuid,organization_id uuid,workspace_id uuid,principal_id text,epoch bigint,capability text,state text);
      CREATE TABLE inbox_events (id bigint GENERATED ALWAYS AS IDENTITY,tenant_id uuid,conversation_id uuid,actor_id text,action text);
    `);
    await query(await readFile(new URL("../../../modules/whatsapp/sql/009_whatsapp_history_commands.sql", import.meta.url), "utf8"));
    await query("INSERT INTO platform_organizations VALUES ($1,$2,'active')", [tenantId, organizationId]);
    await query("INSERT INTO platform_workspaces VALUES ($1,$2,$3,'active')", [tenantId, organizationId, workspaceId]);
    await query("INSERT INTO inbox_conversations VALUES ($1,$2,'whatsapp',$3,$4)", [tenantId, conversationId, organizationId, workspaceId]);
    await query("INSERT INTO whatsapp_accounts VALUES ($1,$2,true,$3)", [tenantId, accountId, organizationId]);
    await query("INSERT INTO whatsapp_conversation_routes VALUES ($1,$2,$3,'stage@lid',NULL)", [tenantId, conversationId, accountId]);
    const foreign = { ...context, organizationId: randomUUID() };
    assert.equal((await transaction(tx => queue.enqueueHistoryPinned(foreign, conversationId, tx))).requested, false);
    await query("INSERT INTO platform_iam_capability_fences VALUES ($1,$2,$3,$4,1,'inbox.conversation.history_sync','active')", [tenantId, organizationId, workspaceId, principalId]);

    await addAnchor("initial", "2026-11-20T00:00:00Z");
    const duplicates = await Promise.all([enqueue(), enqueue()]);
    assert.equal(duplicates.filter(result => result.requested).length, 1);
    const parallel = await Promise.all([worker.deliverNext(tenantId), worker.deliverNext(tenantId)]);
    assert.ok(parallel.includes(true));
    assert.equal(calls, 1);
    assert.equal((await query("SELECT state FROM whatsapp_history_commands")).rows[0].state, "accepted");

    await addAnchor("earlier", "2026-11-19T00:00:00Z");
    assert.equal((await enqueue()).requested, true);
    assert.equal(await worker.deliverNext(tenantId), true);
    assert.equal(await worker.deliverNext(tenantId), false);
    assert.equal((await enqueue()).requested, false);
    assert.equal(calls, 2);
    assert.equal((await query("SELECT state FROM whatsapp_history_commands WHERE anchor_message_id='earlier'")).rows[0].state, "uncertain");

    await addAnchor("revoked", "2026-11-18T00:00:00Z");
    assert.equal((await enqueue()).requested, true);
    epoch = "2";
    assert.equal(await worker.deliverNext(tenantId), true);
    assert.equal(calls, 2);
    assert.equal((await query("SELECT state FROM whatsapp_history_commands WHERE anchor_message_id='revoked'")).rows[0].state, "cancelled");
    assert.equal((await query("SELECT count(*)::int AS n FROM inbox_events WHERE action='history_sync_queued'")).rows[0].n, 3);
  } finally {
    await pool.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
    await pool.end();
  }
});
