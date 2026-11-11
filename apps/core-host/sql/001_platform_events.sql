-- Tenant-local ledger. No operational DDL without backup, tested restore and approval.
-- Control Plane is explicitly excluded; public business tables remain unchanged.
CREATE SCHEMA IF NOT EXISTS platform_events;
CREATE TABLE IF NOT EXISTS platform_events.outbox_events (
 tenant_id uuid NOT NULL,
 event_id uuid NOT NULL,
 organization_id uuid NOT NULL,
 workspace_id uuid,
 event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+\.v[1-9][0-9]*$'),
 event_version integer NOT NULL CHECK (event_version > 0),
 producer text NOT NULL CHECK (producer IN ('crm','inbox','whatsapp','organizations')),
 aggregate_type text NOT NULL CHECK (aggregate_type ~ '^[a-z][a-z0-9_]*$'),
 aggregate_id uuid NOT NULL,
 idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
 correlation_id uuid NOT NULL,
 causation_id uuid,
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text)<=2048),
 routing_state text NOT NULL DEFAULT 'pending' CHECK (routing_state IN ('pending','routed','unsupported')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 routed_at timestamptz,
 PRIMARY KEY (tenant_id,event_id),
 UNIQUE (tenant_id,producer,idempotency_key),
 FOREIGN KEY (tenant_id,organization_id) REFERENCES public.platform_organizations(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (tenant_id,organization_id,workspace_id) REFERENCES public.platform_workspaces(tenant_id,organization_id,id) ON DELETE RESTRICT,
 CHECK ((routing_state='pending' AND routed_at IS NULL) OR (routing_state<>'pending' AND routed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS event_outbox_pending_idx ON platform_events.outbox_events (created_at,event_id)
 WHERE routing_state='pending';
CREATE INDEX IF NOT EXISTS event_outbox_org_idx ON platform_events.outbox_events (tenant_id,organization_id,created_at);
CREATE TABLE IF NOT EXISTS platform_events.event_deliveries (
 tenant_id uuid NOT NULL,
 event_id uuid NOT NULL,
 consumer_id text NOT NULL CHECK (consumer_id ~ '^[a-z][a-z0-9_.-]{1,95}$'),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','retry','completed','dead','suspended')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 12),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_owner uuid,
 lease_until timestamptz,
 last_error_class text CHECK (last_error_class IN ('transient','permanent','unauthorized','unsupported','suspended')),
 claimed_at timestamptz,
 completed_at timestamptz,
 failed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id,event_id,consumer_id),
 FOREIGN KEY (tenant_id,event_id) REFERENCES platform_events.outbox_events(tenant_id,event_id) ON DELETE RESTRICT,
 CHECK ((state='processing' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL)
    OR (state<>'processing' AND lease_owner IS NULL AND lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS event_deliveries_due_idx
 ON platform_events.event_deliveries (next_attempt_at,event_id,consumer_id)
 WHERE state IN ('pending','retry','suspended');
CREATE INDEX IF NOT EXISTS event_deliveries_leases_idx
 ON platform_events.event_deliveries (lease_until)
 WHERE state='processing';
CREATE TABLE IF NOT EXISTS platform_events.consumer_inbox (
 tenant_id uuid NOT NULL,
 event_id uuid NOT NULL,
 consumer_id text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id,event_id,consumer_id),
 FOREIGN KEY (tenant_id,event_id,consumer_id)
  REFERENCES platform_events.event_deliveries(tenant_id,event_id,consumer_id) ON DELETE RESTRICT
);
COMMENT ON SCHEMA platform_events IS 'Tenant-local durable event ledger, never a shared cross-tenant queue';
COMMENT ON TABLE platform_events.consumer_inbox IS 'Effect and processed marker must be committed in one transaction';
