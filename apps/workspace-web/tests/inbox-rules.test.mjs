import { test } from "node:test";
import assert from "node:assert/strict";
import { isMine, replyBlockReason } from "../src/features/inbox-rules.ts";

const actor = "agent-1";
const active = {
  id: "conv-1", subject: "Ajuda", channel: "simulation", status: "open",
  handoff: "human", assignedTo: actor, crmPersonId: null,
};

test("an assigned human attendant can reply to an open conversation", () => {
  assert.equal(replyBlockReason(active, actor), null);
  assert.equal(isMine(active, actor), true);
});

test("resolved conversations require reopen before outbound messages", () => {
  assert.match(replyBlockReason({ ...active, status: "resolved" }, actor), /Reabra/);
});

test("bot handoff blocks human replies even if assigned", () => {
  assert.match(replyBlockReason({ ...active, handoff: "bot" }, actor), /bot/);
});

test("no assignment and another agent's assignment block replies", () => {
  assert.match(replyBlockReason({ ...active, assignedTo: null }, actor), /Assuma/);
  assert.match(replyBlockReason({ ...active, assignedTo: "agent-2" }, actor), /Assuma/);
  assert.equal(isMine({ ...active, assignedTo: "agent-2" }, actor), false);
});

test("unknown actor and absent selection do not permit write UI", () => {
  assert.match(replyBlockReason(active, ""), /identidade/);
  assert.match(replyBlockReason(null, actor), /Selecione/);
});
