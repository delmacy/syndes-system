# INBOX-04 — Realtime and private attachment operations

Task: [`INBOX-04-realtime-attachments.md`](./tasks/PRD-002/INBOX-04-realtime-attachments.md)
Product contract: [`PRD-002-INBOX-SPEC.md`](../product/PRD-002-INBOX-SPEC.md)

This document records the operational contract that is not visible from the
HTTP routes alone: the WebSocket handshake/event contract and the durable
backup/restore procedure for private attachment bytes.

## 1. Realtime transport (WebSocket)

- Endpoint: `GET /api/v1/inbox/realtime` upgraded to WebSocket.
- The handshake is authenticated by the same two guards as every Inbox REST
  route:
  - `Authorization: Bearer <access token>` (existing identity session);
  - the trusted-ingress tenant assertion headers
    (`x-syndes-validated-host`, `x-syndes-validated-at`,
    `x-syndes-validated-signature`) added by the trusted proxy.
- Tenant, database, role and `customer_scope` are resolved **server-side** from
  that handshake. The URL never accepts a tenant/database/db-name selector, and
  the server rejects one with `400`.
- Optional query filter: repeat `conversationId=<uuid>` (maximum 50). It is an
  in-tenant record reference only; every id is re-authorized at open and on
  every event. Omitting it follows every conversation the current scope
  permits.
- The socket is one-way (server → client). Client frames are not part of the
  protocol and close the socket with code `1008`; mutations continue through
  the authorized REST API.
- Server frames are JSON:
  - `inbox.message.created` → `{ messageId }`
  - `inbox.note.created` → `{ noteId }`
  - `inbox.conversation.assigned` → `{ assigneeActorId | null }`
  - `inbox.conversation.status.changed` → `{ status }`
  - `inbox.attachment.created` → `{ attachmentId }`
  - `inbox.realtime.heartbeat` → `{ occurredAt }`
  - `inbox.realtime.revoked` → `{ reason: "membership_inactive" }`, followed by
    close code `1008`.
- Payloads are pointers only. Message bodies, private note text, filenames,
  storage keys and tenant identifiers are never sent over the socket.
- There is no replay buffer or resume cursor. After reconnect the client must
  rebuild durable state through the REST API (`queue`, `detail`, `messages`,
  `attachments`); this is the source of truth.
- Membership and `customer_scope` are re-read before every delivery and
  periodically for idle sockets. A revoked membership or a scope change stops
  delivery without reconnecting.
- Fan-out is in-process for the single-node MVP. Multiple API replicas would
  require a durable broadcast (for example PostgreSQL `LISTEN/NOTIFY`) before
  being deployed.

Because browsers cannot attach an `Authorization` header to a native
`WebSocket`, the web client must reach the API through a same-origin proxy that
injects the bearer token and the trusted-ingress assertion headers (or a
server-side WebSocket bridge). Do not put access tokens or tenant ids in the
WebSocket URL.

## 2. Attachment storage configuration

| Variable                         | Default                                                                                              | Rule                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INBOX_ATTACHMENT_STORAGE_DIR`   | `./var/inbox-attachments` resolved from the API working directory                                    | **Local/dev only**: absolute/relative private directory; rejected when it is a filesystem root, under a webroot/public/static directory, or inside `apps/web`. Must not be a symlink. In production, must be set to a durable private mounted volume outside webroots/container ephemeral layers, and that volume must be included in tenant backup/restore. |
| `INBOX_ATTACHMENT_MAX_BYTES`     | `10485760` (10 MiB)                                                                                  | Positive integer; may only lower the reviewed hard ceiling of `26214400` bytes (25 MiB).                                                                          |
| `INBOX_ATTACHMENT_ALLOWED_TYPES` | `image/png:png,image/jpeg:jpg\|jpeg,image/webp:webp,application/pdf:pdf,text/plain:txt,text/csv:csv` | Comma-separated `mime:ext1\|ext2`; first extension is canonical for the stored key. No wildcards.                                                                 |

Layout: `<storageRoot>/<tenant uuid>/<random uuid>.<canonical extension>`.
Tenant directories are created `0700`, files `0600`. The tenant id comes from
the trusted `TenantContext`; the filename is a server-generated UUID, never the
upload filename. Attachment metadata lives in the tenant PostgreSQL database;
bytes live only under this private directory.

Download is only through `GET /api/v1/inbox/attachments/:id`, which re-runs
identity + tenant routing, requires the attachment's conversation to remain
visible to the acting user/scope, re-verifies size and SHA-256, and responds
with `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` and
an attachment disposition. There is no public or permanent URL.

### Symlink and path-escape defenses

- The configured root and each tenant directory must be real directories:
  `lstat` rejects links/junctions and `realpath` must still resolve to the same
  path under the canonical root.
- Every persisted key is re-parsed and must belong to the current tenant;
  traversal, foreign-tenant and unexpected-shape keys are refused before any
  filesystem access.
- Final object files must be regular files; a symlinked object is treated as
  corrupt (`404` to the client) and never followed. On POSIX the file is opened
  with `O_NOFOLLOW`; the parent directory is revalidated immediately before
  publishing a new object.
- Uploads are written to a temporary sibling with `O_CREAT|O_EXCL`, flushed,
  and renamed into place, so a partial upload never becomes readable. A link
  planted at the destination name is replaced on POSIX rather than followed;
  on Windows an existing destination makes the rename fail and the temporary
  file is removed.
- Files are re-hashed on download; size/digest mismatch, a missing object or a
  non-regular file is an indistinguishable `404`.

Residual limit: Node has no `openat`/`dirfd`. A privileged local attacker able
to atomically swap a directory between the last validation and the open is
outside this process-level defense. The storage volume must therefore be
accessible only to the API service account.

## 3. Durable backup and restore (tenant procedure)

Attachment bytes are part of the tenant's durable state and **must be backed up
together with that tenant's PostgreSQL database**. A database-only backup is an
incomplete restore: metadata rows without bytes produce `404`s; bytes without
metadata are unreadable orphans.

### Backup

1. Snapshot the tenant PostgreSQL database and the attachment volume at the
   same logical point in time (storage snapshot plus database snapshot, or a
   filesystem snapshot that includes both). Prefer a crash-consistent volume
   snapshot with the database in hot-standby/backup mode.
2. Include the whole configured `INBOX_ATTACHMENT_STORAGE_DIR`, preserving the
   tenant-directory layout, file names and permissions. Do not rewrite,
   deduplicate or follow symlinks during backup.
3. Encrypt backups at rest and in transit with the same controls as the tenant
   database. Restrict restore credentials to the platform operator role.
4. Retain backups according to the tenant's contractual retention. A backup is
   not a substitute for the tenant-database retention policy, and deletion of a
   tenant must delete both metadata and attachment objects.
5. Record backup completion (tenant id, snapshot ids, timestamp, size, hash of
   the storage manifest) without recording file contents or object keys in
   operational logs.

### Restore and verification

1. Restore the tenant database and the storage directory into an isolated
   environment first; never point a restore at a live tenant.
2. Keep the tenant directory names identical to the restored tenant ids. Verify
   the root is a real directory (not a symlink) and contains no links escaping
   the root.
3. For a sample of attachments (at minimum one per tenant, plus every object in
   a smoke conversation), compare the restored file size and SHA-256 with the
   `inbox_attachments` row. Then exercise the authorized download endpoint and
   confirm unauthorized/cross-tenant/out-of-scope downloads still return `404`.
4. Record the restore test result (date, tenant, sample count, result) in the
   tenant operations record. A restore test that has not been run is not
   evidence of restorability.
5. Only after verification may the restored database/storage pair serve
   traffic. Rotate any credentials used during the restore drill.

### Capacity and limits

- Plan storage for the configured per-file ceiling × expected attachments per
  conversation, plus temporary upload space (one extra file in flight per
  concurrent upload).
- Monitor free space and failed writes; a full volume must fail uploads with a
  server error and must not leave partial readable files.
- The 25 MiB hard ceiling and the 10 MiB default are application limits, not a
  substitute for the reverse proxy's upload limit; keep both aligned.

## 4. Verification commands

From `apps/api`:

```bash
npm run typecheck
npx jest --runInBand src/modules/inbox --testPathIgnorePatterns .postgres.integration
```

**Production origin configuration**: In production, `API_ORIGIN` is the exact public API origin
and `WS_ALLOWED_ORIGINS` is a comma-separated allowlist of exact browser frontend /
proxy origins. Each must be a canonical `http:` or `https:` origin with path `/`,
no username/password, and no search/hash. Wildcards, paths, and queries are not
permitted. The gateway validates these at startup (fail-closed); any malformed
value causes the service to fail to boot. Browser `Origin` headers are validated
against the exact `API_ORIGIN` or one exact entry from `WS_ALLOWED_ORIGINS` at the
WebSocket handshake, with `403` rejected for any malformed/non-canonical value.
This configuration reflects a reverse proxy deployment where the browser reaches
the API through a same-origin proxy that injects bearer tokens and trusted-ingress
assertion headers.

The disposable PostgreSQL integration spec
(`inbox-realtime-attachments.postgres.integration.spec.ts`) runs only when a
disposable `CONTROL_PLANE_DATABASE_URL` with `CREATE DATABASE` is supplied; it
must never be pointed at the shared environment. It covers tenant/scope
isolation, revocation, attachment denial, path traversal and storage
integrity.
