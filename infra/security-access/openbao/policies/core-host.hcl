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
