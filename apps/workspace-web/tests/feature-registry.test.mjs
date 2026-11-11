import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { primaryNavigation, resolveWorkspaceView, viewRequiresApi, workspaceFeatures } from "../src/app/feature-registry.ts";

test("fixed registry matches the four existing routes without runtime plugins", () => {
  const ids = Object.keys(workspaceFeatures);
  assert.deepEqual(ids, ["overview", "inbox", "crm", "settings"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(primaryNavigation.map(item => item.id), ["overview", "inbox", "crm"]);
  assert.deepEqual(primaryNavigation.map(item => item.title), ["Visão geral", "Inbox", "CRM"]);
  assert.equal(workspaceFeatures.settings.navigation, false);
  assert.equal(viewRequiresApi("crm"), true);
  assert.equal(viewRequiresApi("inbox"), true);
  assert.equal(viewRequiresApi("overview"), false);
  assert.equal(viewRequiresApi("settings"), false);
});

test("unknown, malformed and prototype hash routes never mount arbitrary content", () => {
  for (const source of ["", "#", "#unknown", "#__proto__", "constructor", "#crm/other", "#account", "#billing", "#%3Cscript%3E"]) {
    assert.equal(resolveWorkspaceView(source), "overview", source);
  }
  assert.equal(resolveWorkspaceView("#overview"), "overview");
  assert.equal(resolveWorkspaceView("#inbox"), "inbox");
  assert.equal(resolveWorkspaceView("#crm"), "crm");
  assert.equal(resolveWorkspaceView("#settings"), "settings");
});

test("frontend registry is static and separated from backend plugin mounting and credentials", async () => {
  const source = await readFile(new URL("../src/app/feature-registry.ts", import.meta.url), "utf8");
  const shell = await readFile(new URL("../src/app/workspace-shell.tsx", import.meta.url), "utf8");
  const outlet = await readFile(new URL("../src/app/workspace-feature-outlet.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const context = await readFile(new URL("../src/contexts/use-active-workspace.ts", import.meta.url), "utf8");
  assert.match(shell, /primaryNavigation\.map/);
  assert.match(outlet, /renderers\[props\.view\]/);
  assert.doesNotMatch(app, /moduleNavigation|viewTitles|SidebarProvider|<CrmFeature|<InboxFeature/);
  assert.match(context, /directory\?\.owner === baseApi/);
  assert.match(context, /if \(!live\) return/);
  assert.match(context, /prev\?\.owner !== baseApi/);
  assert.match(context, /prev\.entries\.some/);
  for (const item of [source, shell, outlet, context]) {
    assert.doesNotMatch(item, /SYNDES_MASTER|master-admin-api|module[-_]installer|openfga.*token/i);
  }
});
