# Bind exclusively to the isolated staging Core AppRole, on staging OpenBao.
path "kv/data/multi-org-staging/core-host" { capabilities = ["read"] }
path "auth/token/revoke-self" { capabilities = ["update"] }
