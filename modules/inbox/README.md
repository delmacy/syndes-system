# Inbox — PRD-002
Independent, trusted `@syndes/inbox/plugin` package. Depends on CRM and Platform, without WhatsApp or email provider code in the domain.

- Conversations from approved service identities, linked optionally to a canonical CRM Person.
- Inbound message deduplication by tenant + channel + external message ID.
- Durable outbound queue; actual sending is delegated to the future WhatsApp module.
- Conversation status, self-assignment, human handoff and audited events.
- Read-only cursor-based event feed for authorized polling. Production realtime push can be added later.
- Attachments have tenant-scoped metadata schema but upload/download are **not exposed** until object storage permission and validation contracts are implemented.
- HTTP API and responsive Inbox UI with Keycloak PKCE.

## Safety
The external channel reference never chooses a tenant. The verified JWT actor plus CoreKernel membership and OpenFGA authorization run BEFORE resolving the tenant database. Each SQL query also checks tenant ID. Assignment is self-only initially, to prevent arbitrary unverified user IDs. A provider webhook must authenticate upstream and use an authorized service JWT; do not expose an unauthenticated inbound endpoint.

## Development status
The package is under development. CI and isolated-database integration are required before its Product Gate. Real provider delivery, rate limits and transport retries belong to PRD-003 WhatsApp; none of these are falsely represented as delivered by the Inbox.
