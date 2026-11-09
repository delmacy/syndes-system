# Dedicated Core Host tenant database resolver identity.
# Never grant PostgreSQL admin or cross-product secrets to this AppRole.
# Tenant UUID is verified against the active Control DB registry BEFORE use.
# Each PostgreSQL role is scoped to its own tenant database.
path "kv/data/production/tenants/*" {
  capabilities = ["read"]
}
path "auth/token/revoke-self" {capabilities=["update"]}
