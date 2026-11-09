# OpenBao — Syndes Security and Access

OpenBao is **part of the same Compose project** as Keycloak and OpenFGA: `syndes-security-access`. Its state lives on an independent named Docker volume (`openbao_raft`, mounted at `/openbao/file`) using Integrated Storage (Raft). **No PostgreSQL database for OpenBao is needed.** This avoids a bootstrapping loop when PostgreSQL credentials eventually come from OpenBao.

## Boundaries

- OpenBao server image pinned to `openbao/openbao:2.7.0` and starts with `bao server`; no dev mode, automatic init, root token or unseal material in Compose.
- HTTPS listener (TLS v1.2+) on `openbao:8200`, no published host ports.
- Accessible only on `syndes-secrets`, an internal Docker network shared by explicitly authorized services.
- Configuration is source-controlled, **TLS private key is not**. Mount only provisioned `tls/server.crt` and `tls/server.key` from a protected root/operator-controlled directory. The certificate must include DNS SAN `openbao`; use a private CA trusted by every consuming agent.
- The Raft volume is **encrypted by OpenBao's barrier**, but encryption is unavailable until an operator unseals it. A single-node volume is not high availability.
- The policy templates under `policies/` are examples only: they are not activated or attached to an identity automatically.

## Production preparation (operator action)

1. Provision TLS key/certificate using your organization's private CA, valid for `openbao`. Never commit the private key. Restrict local file permissions according to the container runtime UID.
2. Start the stack after the PostgreSQL network and database are available:
   `docker compose --env-file infra/.env -f infra/security-access/compose.yaml up -d`.
3. Initialize **once**, interactively, using encrypted operator PGP public keys:
   `docker compose --env-file infra/.env -f infra/security-access/compose.yaml exec openbao bao operator init -key-shares=3 -key-threshold=2 -pgp-keys="<operator-public-key-1>,<operator-public-key-2>,<operator-public-key-3>" -root-token-pgp-key="<operator-root-token-public-key>"`.
   Adapt share distribution/threshold to the actual operator team. The angle-bracket arguments are examples, not usable values. **Never generate or store unseal shares or root token in GitHub, Docker logs, the server's `.env`, or the Komodo database.** Record them offline in an independently protected recovery process.
4. Unseal with a secure interactive terminal using `bao operator unseal` and off-host key shares. OpenBao starts sealed again after reboot unless a separately governed external KMS/HSM auto-unseal mechanism is configured.
5. With short-lived privileged credentials, enable a versioned KV store (e.g. `bao secrets enable -path=kv -version=2 kv`), configure an approved audit device, workload authentication, and least-privilege service policies. Revoke initial bootstrap root access once alternate administrative identities and recovery procedures are operational.
6. Configure individual service identities for Core Host, Keycloak, OpenFGA and future applications. No service may read other services' namespaces. Prefer short-lived leases/rotatable database credentials and **file templates mounted in memory** where supported; only use environment-variable delivery when the application has no secure file API.

### Important migration limitation

**Core Host is now the first OpenBao consumer.** It authenticates via AppRole credentials mounted as Docker secrets from volatile host files, reads `kv/data/production/core-host` over verified HTTPS and revokes its bootstrap token. PostgreSQL, Keycloak and OpenFGA still receive their own startup/bootstrap secrets from the existing `.env` mechanism; they are **not yet migrated**. Before production, replace those environment secrets with a compatible file/Agent delivery mechanism and verify their absence from Compose and Docker metadata. Service-specific identity credentials must still be distributed securely outside Git. See `apps/core-host/README.md`.

The first secrets bootstrap and TLS trust root necessarily have to be established out-of-band. No secrets manager can securely manufacture its own initial operator trust without an external trust anchor.

## Disaster recovery

- Keep offline-encrypted, tested Raft snapshots and TLS material in separate protected backup infrastructure. Use OpenBao's `bao operator raft snapshot save` only after authentication; do not treat Docker's named volume as a backup.
- Back up/unseal-key custody and audit records independently. Losing the required recovery/unseal keys makes encrypted data irrecoverable.
- Test restart, seal/unseal, Raft snapshot/restore and service reauthentication before production.
- Monitor seal state, audit logging, token TTLs, storage health and snapshot recovery; schedule upgrades deliberately.

## CI

`tests/platform/openbao-smoke.sh` exercises trusted TLS, one-time initialization, unseal, KV write/read, restart/seal and recovery of the encrypted Raft volume. **The 1-of-1 test key and root token are ephemeral CI-only values**, created in a disposable volume that the workflow deletes. Never reuse this initialization method or its credentials in production.
