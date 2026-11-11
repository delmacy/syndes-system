export { crmModule, CrmService } from "./service.js";
export { CrmDefaultContextGuard } from "./context-guard.js";
export type { AuthorizedCrmDefaultContext } from "./context-guard.js";
export { PgCrmRepository, PgCrmRepositoryFactory } from "./postgres.js";
export { CrmValidationError, TenantDatabaseMismatchError } from "./contracts.js";
export { isUuid } from "./validation.js";
export {CrmWhatsAppIdentityPolicy,CrmWhatsAppIdentityConsumer} from "./whatsapp-identity-events.js";
export type {CrmIdentityScope,CrmWhatsAppIdentitySource,CrmIdentityDecision} from "./whatsapp-identity-events.js";
export type {
  CrmRepository, TenantDatabase, TrustedTenantDatabaseProvider, Organization,
  Person, PersonOrganization, CreateOrganization, CreatePerson, CrmContext,
  Tag, PersonTag, Note, TimelineEntry,
} from "./contracts.js";
export {CrmExtras,PgCrmExtras,PgCrmExtrasFactory} from "./extra.js";
export {parseContactsCsv,contactsToCsv} from "./csv.js";
export type {Employee,ChannelIdentity,DuplicateCandidate,ImportResult,ExtraRepository} from "./extra.js";
