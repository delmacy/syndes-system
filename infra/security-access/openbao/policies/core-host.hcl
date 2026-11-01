# Example least-privilege KV v2 policy; bind only to the Core Host service identity.
path "kv/data/production/core-host" {
  capabilities = ["read"]
}
path "kv/data/production/core-host/*" {
  capabilities = ["read"]
}
path "kv/metadata/production/core-host/*" {
  capabilities = ["list"]
}

# Allow this short-lived AppRole token to revoke itself after reading startup secrets.
# This grants no ability to revoke another identity's token.
path "auth/token/revoke-self" {
  capabilities = ["update"]
}
