# I06 — Traefik HTTPS | source reconciliation (2026-11-14 09:00 BRT)

**Authoritative source:** GitHub `delmacy/syndes-system`, base `1cf48cc0a1281017ac58f7b9b9747f663109e151`; branch `audit/i06-ingress-source-20261114-0900`. This is a source-only, read-only audit except for this new documentation checkpoint. Prior I06 audits and the I08 Komodo checkpoint are historical, not operational evidence for this SHA.

## Verified public/private boundary

- `modules/whatsapp/deploy/devserver01-cutover.compose.yaml` declares two **HTTP router labels**, not a TLS endpoint contract: `syndes-core-whatsapp-v2` matches host plus `/v1/` or `/modules/`, priority 110, entrypoint `web`, backend port 8082; `syndes-workspace-whatsapp-v2` matches the host, priority 2, entrypoint `web`, backend port 80.
- Both services use `traefik.enable=true`, `traefik.docker.network=infra-proxy` and reference `syndes-tailnet-only@docker`. **Definition and effective enforcement of this middleware are not established** by these labels. Neither router declares `tls=true` or `websecure`; do not infer end-to-end HTTPS from the I06 title. External TLS termination or global redirect could exist, but was not inspected.
- The cutover Compose declares five external Docker networks and host-specific image/mount/environment references. It is a reversible shadow deployment, **not** a self-contained proxy stack. The Core Host is attached to additional data, security, secrets and web networks, whereas the workspace shadow is on proxy/web networks. These attachments are configuration claims, not verified runtime segmentation.
- `infra/README.md` states normative requirements to avoid direct public exposure of databases, Keycloak administration, OpenFGA and Core Host; this is not proof that Traefik, firewall or Docker implement them.

## Ownership and implementation matrix

| Dimension | Evidence | Status / boundary |
|---|---|---|
| Owner | `docs/subprojects/I06-traefik-https/STATUS.md`, `REFERENCIA-TECNICA.md` | I06 documentation; executable labels in WhatsApp-owned cutover Compose, shared boundary |
| Source | `modules/whatsapp/deploy/devserver01-cutover.compose.yaml` | Declarative routers and services verified at base SHA |
| Public/private contracts | Host/path router, priority, middleware reference, external network | Manifest verified; effective ingress/allowlist unverified |
| Classes/methods | No I06 programmatic classes established in inspected sources | Not applicable to inspected declarative surface; no repository-wide absence claim |
| HTTP APIs | Reverse-proxy forwards to ports 8082 and 80 | No I06 business endpoint created or validated |
| Events | No event producer/consumer established in inspected sources | Not attributable; not a global absence claim |
| Schemas/migrations | No I06-owned schema/migration established | No SQL inspected or executed |
| Tests | No isolated tests run; no I06 test suite or CI result tied to base SHA | Test success unverified |
| Runtime | Prior dated observation only, not repeated | No current TLS, routing, firewall or middleware verification |
| Deploy/homologation | No deployment or approval evidence tied to base SHA | Not proven |
| Public Pages | No public Pages SHA checked | Not proven |

## Reconciliation / material risk

The canonical I06 STATUS and reference **already correctly identify** the versioned Compose and the entrypoint `web`. A later isolated checkpoint that reports the executable Traefik configuration as not located should not erase this narrower, proven source fact: **cutover labels are present**, while **global/static/dynamic Traefik configuration remains unlocated/unverified**. This is a distinction of scope, not proof of a working HTTPS ingress. The most material outstanding gate is demonstrating actual TLS termination and enforcement of `syndes-tailnet-only@docker` with authorized positive and negative cases.

## Non-actions and next gates

No DevServer access; no tests, network probes, SQL, migrations, secrets, runtime changes, CI/workflow changes, deploy, merge or modifications to another agent's branch. Inspect GitHub-owned global proxy configuration and middleware definition, then collect SHA-linked CI and authorized read-only operational evidence. Reconcile other 57 catalog units plus discovered owners separately. Review gates, zero global divergence and published GitHub Pages SHA **remain unconfirmed**. Do not promote I06 to homologated.
