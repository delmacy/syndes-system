# Only the trusted provisioning job receives these read capabilities.
path "kv/data/production/postgres" { capabilities = ["read"] }
path "kv/data/production/keycloak" { capabilities = ["read"] }
path "kv/data/production/openfga" { capabilities = ["read"] }
path "auth/token/revoke-self" { capabilities = ["update"] }
