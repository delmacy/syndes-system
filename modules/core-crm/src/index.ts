export { crmModule, CrmService } from "./service.js";
export { PgCrmRepository, PgCrmRepositoryFactory } from "./postgres.js";
export { CrmValidationError, TenantDatabaseMismatchError } from "./contracts.js";
export { isUuid } from "./validation.js";
export type {
  CrmRepository, TenantDatabase, TrustedTenantDatabaseProvider, Organization,
  Person, PersonOrganization, CreateOrganization, CreatePerson, CrmContext,
} from "./contracts.js";
