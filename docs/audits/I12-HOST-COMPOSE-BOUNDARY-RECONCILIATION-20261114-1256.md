# I12 — Host security: Compose boundary reconciliation (2026-11-14 12:56 -03)

## Source baseline and concurrency

- GitHub MCP canonical `main@1cf48cc0a1281017ac58f7b9b9747f663109e151`; compare with main identical before branch creation.
- Dedicated branch `audit/i12-host-boundary-compose-20261114-1256`. Earlier I12 branch `audit/i12-host-security-20261113-1400` exists, is 18 commits behind main and one ahead of its ancestor; not modified or merged.
- Catalog `catalog/work-units.json` assigns I12 to `infra`, maturity `partial`, parent I02. Maturity is catalog metadata, **not** operational acceptance.

## Public/private boundaries verified statically

- `infra/postgres/compose.yaml`: PostgreSQL 17 uses file-backed secrets, private `syndes-data` and `syndes-master-data` external networks, no host-published database port, healthcheck and `no-new-privileges`. A shared server still requires DB-level CONNECT isolation; no running grants were examined.
- `infra/security-access/compose.yaml`: Keycloak 26.8.1, OpenFGA 1.22.1 and OpenBao 2.7.0 images are version-pinned; no explicit host port mappings in the inspected file. OpenBao uses internal secrets network, dropped capabilities, read-only config mounts; Keycloak attaches to `syndes-master-identity` and uses HTTP behind separately provisioned trusted HTTPS ingress. Network names and Compose declarations do not prove firewall or host runtime state.
- `infra/master-admin/compose.yaml`: master API isolated on three named networks; master web binds to `127.0.0.1:${MASTER_BIND_PORT:-18085}`; both containers declare read-only filesystem, tmpfs, dropped capabilities and `no-new-privileges`. API image is built locally, not shown as immutable release artifact here.
- `infra/README.md` explicitly warns Docker/Komodo operators retain privileged access, requires private networks, least-privilege roles and manual OpenBao unseal/bootstrap. `docs/engineering/PLATFORM-MANAGER-RELEASE.md` explicitly marks Manager homologation blocked and demands real TLS, identity, DB and network acceptance.
- `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` describes **unversioned** local Traefik/Workspace manifests and a 2026-11-01 lab verification. This historical note is not a current host observation; no inference that current HTTPS is valid.

## Contract matrix and unresolved evidence

| Dimension | Observed | Not established |
| --- | --- | --- |
| Public network exposure | No explicit `ports` in PostgreSQL/Security Compose; Manager web loopback binding | Docker runtime ports, host firewall, external proxy/Tailnet, DNS, TLS chain |
| Private isolation | Named Compose networks and per-service attachments | Effective network membership, host forwarding, tenant DB CONNECT grants |
| Privileges/secrets | Compose `no-new-privileges`, cap drop on selected services, file-backed secrets | Actual UID, rootless daemon, mounted permissions, policy enforcement, secret lifecycle |
| Classes / APIs | I12 is infra ownership; Manager/API and Core Host implementations are separate owners | API 401/403, auth grants, cross-tenant negatives, runtime classes |
| Events | No I12-owned event publisher identified in inspected Compose | Cross-owner audit event delivery or logs |
| Schemas/migrations | References to bootstrap/control admin schema in release guide | No schema/migration content reviewed or applied in this checkpoint |
| Tests | Runbook and release guide enumerate CI/smoke and operational gates | No tests executed, no current CI result linked to this SHA |
| Deployment | Historical lab runbook and pending Manager release guide | No current deployed/homologated state established |

## Review gates and limitations

This is a **partial I12 static reconciliation**, not full host hardening audit. No host inventory, `docker inspect`, firewall, Traefik global config, kernel hardening, audit logs, image provenance or operational evidence was inspected. No tests were run. No DevServer access, SQL, migrations, runtime commands, secrets, CI/workflows, deployments or other agents' branches were touched. Do not promote I12 to verified/homologated based on these declarations. Other catalog units (57 total plus discovered owners), global divergences, review gates and public GitHub Pages SHA remain unconfirmed. Next: verify host security acceptance evidence through authorized read-only operational inspection only if necessary, then advance Q01 platform testing owner.
