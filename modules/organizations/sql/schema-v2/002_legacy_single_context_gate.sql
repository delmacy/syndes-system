-- CANDIDATE ONLY (AK-40.01). NOT wired into the legacy Host migration manifest.
-- Generated from sql/002_legacy_single_context_gate.sql; do not edit this output by hand.
-- Requires separately installed CRM/Inbox/WhatsApp schemas and approved AK-30 installer.
-- SM-F1.0c safety barrier: legacy CRM/Inbox and Whatsmeow still operate
-- with tenant-wide queries, SSE and channel bindings.
-- Until all those paths are organization/workspace scoped, the SAME tenant
-- MUST NEVER contain more than one operating organization or workspace.
--
-- Unique indexes are database-enforced, including direct SQL and concurrent
-- transactions. This gate is intentionally not a feature flag or UI check.
-- An existing multi-org tenant causes migration to FAIL CLOSED without
-- deleting/collapsing records. Removing the indexes requires a subsequent
-- reviewed migration after CRM/Inbox/channel isolation tests pass.
-- Do not issue BEGIN/COMMIT: the CI test installs migrations in a disposable
-- savepoint, and the migration operator owns its transaction boundary.
CREATE UNIQUE INDEX IF NOT EXISTS platform_legacy_single_organization
  ON organizations.platform_organizations(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS platform_legacy_single_workspace
  ON organizations.platform_workspaces(tenant_id);
