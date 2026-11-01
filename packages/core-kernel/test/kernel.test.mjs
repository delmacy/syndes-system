import assert from "node:assert/strict";
import test from "node:test";
import { AccessDeniedError, CoreKernel, ModuleRegistry } from "../dist/index.js";

const request = {
  actor: { kind: "user", id: "user-a" },
  tenantId: "tenant-a",
  action: "person.read",
  resource: "person:42",
};

const create = (membership, policy, modules = []) =>
  new CoreKernel({
    modules,
    tenancy: { canAccessTenant: async () => membership },
    authorization: { canAccess: async () => policy },
  });

test("modules initialize in dependency order once", async () => {
  const initialized = [];
  const modules = [
    { id: "crm", version: "1.0.0", dependencies: ["identity"], initialize: () => initialized.push("crm") },
    { id: "identity", version: "1.0.0", initialize: () => initialized.push("identity") },
  ];
  const kernel = create(true, true, modules);
  await Promise.all([kernel.start(), kernel.start()]);
  assert.deepEqual(initialized, ["identity", "crm"]);
});

test("registry rejects duplicates, missing dependencies, cycles and malformed identifiers", () => {
  assert.throws(() => new ModuleRegistry([
    { id: "crm", version: "1.0.0" }, { id: "crm", version: "1.0.1" },
  ]), /Duplicate/);
  assert.throws(() => new ModuleRegistry([
    { id: "crm", version: "1.0.0", dependencies: ["missing"] },
  ]).ordered(), /Missing/);
  assert.throws(() => new ModuleRegistry([
    { id: "a", version: "1.0.0", dependencies: ["b"] },
    { id: "b", version: "1.0.0", dependencies: ["a"] },
  ]).ordered(), /Circular/);
  assert.throws(() => new ModuleRegistry([{ id: "Invalid Module", version: "1.0.0" }]), /Invalid/);
});

test("a failed bootstrap prevents any protected operation", async () => {
  const kernel = create(true, true, [{ id: "crm", version: "1.0.0", initialize: () => {
    throw new Error("database unavailable");
  } }]);
  await assert.rejects(kernel.start(), /database unavailable/);
  await assert.rejects(kernel.execute(request, () => 1), /database unavailable/);
});

test("requires positive tenant membership AND policy permission", async () => {
  for (const [membership, policy] of [[false, false], [false, true], [true, false]]) {
    let executed = false;
    const kernel = create(membership, policy);
    await kernel.start();
    await assert.rejects(kernel.execute(request, () => { executed = true; }), AccessDeniedError);
    assert.equal(executed, false);
  }
  const kernel = create(true, true);
  await kernel.start();
  assert.equal(await kernel.execute(request, () => 42), 42);
});

test("cross-tenant and malformed contexts are denied", async () => {
  const kernel = new CoreKernel({
    modules: [],
    tenancy: { canAccessTenant: async ({ tenantId }) => tenantId === "tenant-a" },
    authorization: { canAccess: async () => true },
  });
  await kernel.start();
  await assert.rejects(kernel.execute({ ...request, tenantId: "tenant-b" }, () => "leak"), AccessDeniedError);
  await assert.rejects(kernel.execute({ ...request, actor: { id: "", kind: "user" } }, () => "leak"), AccessDeniedError);
});

test("unavailable authorization service fails closed", async () => {
  const kernel = new CoreKernel({
    modules: [],
    tenancy: { canAccessTenant: async () => true },
    authorization: { canAccess: async () => { throw new Error("OpenFGA unavailable"); } },
  });
  await kernel.start();
  let ran = false;
  await assert.rejects(kernel.execute(request, () => { ran = true; }), /OpenFGA unavailable/);
  assert.equal(ran, false);
});

test("registry snapshots module metadata without depending on source arrays", () => {
  const deps = ["identity"];
  const registry = new ModuleRegistry([
    { id: "crm", version: "1.0.0", dependencies: deps },
    { id: "identity", version: "1.0.0" },
  ]);
  deps.pop();
  assert.deepEqual(registry.ordered().map((m) => m.id), ["identity", "crm"]);
});
