# Separate resolver identity. No production, Control, admin or write permission.
path "kv/data/multi-org-staging/tenants/*" { capabilities = ["read"] }
path "auth/token/revoke-self" { capabilities = ["update"] }
