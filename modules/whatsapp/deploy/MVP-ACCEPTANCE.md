# WhatsApp MVP — acceptance evidence and release gates (2026-11-04)

## Scope and immutable acceptance rules

The WhatsApp channel uses whatsmeow linked-device sessions, NOT Meta Cloud API.
The linked session must not be deleted, disconnected or paired again as part of testing.
No messages or group changes may be sent to real users without a specifically approved test destination.

| Gate | Evidence collected | Remaining |
| --- | --- | --- |
| Inbound session and contact names | One linked WhatsApp account connected; user verified names in Inbox | Confirm reconnect under controlled maintenance |
| Outbound no-duplicate control | 53 TS tests (including two simulated tenants, gateway timeout, stable idempotency key, terminal failed state); Go race tests | **Real delivery to a designated test recipient** |
| Group canonical writes | Go + TS + Playwright mocked and deployed | **Real name/description change in a dedicated test group** |
| Contact and group photos | Authenticated routing and mock render/fallback passed | **Check real avatars under different privacy settings** |
| Tenant and agent isolation | Separate test tenants, FGA HTTP 401/403/404 and PostgreSQL boundary integration passed | **Two real provisioned tenant sessions and agent roles** |
| Failure recovery | Isolated FGA, database lease, SQL failures and transport timeout passed | **Controlled service restart, queue drain and rollback drill** |
| CI and version control | WhatsApp CI workflow + frozen npm lockfile added | Required GitHub branch checks and green PR run after push |

## Controlled real-message acceptance (requires an approved destination)

1. Use only a dedicated WhatsApp test contact/phone, not an arbitrary historic customer conversation.
2. Ensure the active account is linked and the assigned agent has write permission.
3. From the authorized Inbox, send a new unique marker such as `SYNDES-MVP-TEST-<date>-<nonce>`.
4. Confirm on the receiving device that the exact message arrives **once** and is from the correct WhatsApp account.
5. Verify the Inbox status transition from queue → sending → sent and that the persisted provider ID is present. The `sent` state means the provider acknowledged submission, **not** recipient read/delivery.
6. Temporarily disconnect the test phone only in a coordinated maintenance window; after reconnect verify the same marker is not automatically sent again.
7. Do not retry an unknown/failed submission with a different idempotency key. Reconcile first.

## Canonical group acceptance (requires a dedicated test group)

1. Obtain group admin/editor permission in WhatsApp. Do not modify a client group.
2. Open group information in Syndes; compare exact name, description, participant count with the phone.
3. Change only the test group's description to a unique neutral value.
4. Reopen the group details, verify the value comes from WhatsApp, then confirm it on the phone.
5. Restore the previous description and confirm in both systems.
6. Observe a WhatsApp-side name change syncing back into Syndes.

## Avatar privacy acceptance

Check one permitted contact, one contact with no photo/hidden privacy, and one group.
When the provider withholds a photo, the Inbox must show its own icon (never a broken image).
The photo must be fetched only by an authorized Inbox reader and may not leak a provider CDN URL.

## Two real tenants / distinct agent roles

Create two synthetic tenants A/B and distinct agents:
- Tenant A Inbox read/write user; Tenant B user with no A relationship.
- Tenant B's session/account must not appear in A.
- Attempt cross-tenant conversation, message, group, avatar, contact-name mutation: expect deny without database lease or cross-tenant record.
- Repeat with a read-only agent to confirm write restrictions.
- Record only anonymized counts and HTTP statuses (no tokens, JIDs or message content).

## Rollback and recovery (not yet exercised against the live instance)

Current release images: `syndes/core-host:inbox-avatars-20261104`,
`syndes/whatsapp-gateway:inbox-avatars-20261104`.
Previous known images: `syndes/core-host:inbox-recent-filters-20261104`,
`syndes/whatsapp-gateway:group-canonical-20261104`.
Before-release frontend backup:
`/home/delmacy/syndes-releases/inbox-avatars-20261104/workspace-dist-before`.
Compose override files under:
`/home/delmacy/syndes-releases/inbox-avatars-20261104/`.

Rollback must be rehearsed **only during a scheduled maintenance window**:
1. Verify backups, current image digests, tenants, account connection and FGA/OpenBao readiness.
2. Freeze outgoing test traffic; never resend uncertain messages automatically.
3. Restore only the compatible **Core Host + gateway** image pair using the versioned Compose overrides.
4. Restore the frozen frontend backup atomically and verify the Traefik/HTTPS route.
5. Verify OpenBao, app readiness, callback compatibility, tenant routing and session reconnection.
6. Check pending, processing, sent and failed intents for duplicates before allowing writes.
7. Return to the new release, verify no data loss, then document timestamps and evidence.

Do **not** run `rollback-devserver01.sh` unreviewed: it stops the shadow stack and
does not repoint the old Core Host callback automatically.
Never reverse additive tenant migrations as part of image rollback.

## CI rules expected in GitHub

The `WhatsApp MVP Gate` workflow supplies two distinct required checks:
- `WhatsApp TS contracts, isolation and outbound`
- `Whatsmeow Go provider, race and safety`

Keep `Core Inbox CI`, `Core Host and Infrastructure CI`, and `Syndes Workspace UI CI` enabled.
On protected main branch, require successful checks and a PR before merge.
Publishing a workflow alone does not enable GitHub rulesets/branch protection.
