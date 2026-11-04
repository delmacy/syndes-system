-- Provider-confirmed receipts only, scoped to tenant and linked WhatsApp account.
-- Separate from outgoing transport states: "sent" is not "delivered".
CREATE TABLE IF NOT EXISTS whatsapp_delivery_receipts (
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 provider_message_id varchar(256) NOT NULL CHECK(char_length(provider_message_id)>0),
 chat_external_id varchar(256) NOT NULL CHECK(char_length(chat_external_id)>3),
 status varchar(12) NOT NULL CHECK(status IN ('delivered','read')),
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,account_id,provider_message_id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS whatsapp_delivery_receipts_lookup_idx
 ON whatsapp_delivery_receipts(tenant_id,account_id,provider_message_id);


-- Safe when executed as an operator on a real tenant database. Runtime access
-- is granted only to that database's corresponding tenant role; other tenants
-- receive no access. In the shared CI database there is no tenant DB role.
DO $$
DECLARE tenant_role text;
BEGIN
  IF current_database() ~ '^syndes_tenant_[0-9a-f]{32}$' THEN
    tenant_role := 'syndes_t_' || substring(current_database() from 15);
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=tenant_role) THEN
      RAISE EXCEPTION 'Expected tenant runtime role missing';
    END IF;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.whatsapp_delivery_receipts TO %I',tenant_role);
  END IF;
END;
$$;
