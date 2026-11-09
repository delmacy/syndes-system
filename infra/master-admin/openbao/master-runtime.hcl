# Dedicated AppRole policy for Syndes Platform Manager runtime delivery.
# No access to tenant, Core Host, Keycloak, OpenFGA or system bootstrap secrets.
path "kv/data/production/platform-manager" {
  capabilities = ["read"]
}
path "auth/token/revoke-self" {
  capabilities = ["update"]
}
