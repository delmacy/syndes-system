import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '../platform-core/platform-core.module';
import { CrmAuditWriter } from './crm-audit';
import { TenantCrmDatabase } from './tenant-crm.database';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { OrganizationsController } from './organizations/organizations.controller';
import { OrganizationsService } from './organizations/organizations.service';
import { PeopleController } from './people/people.controller';
import { PeopleService } from './people/people.service';
import { RelationshipsController } from './relationships/relationships.controller';
import { RelationshipsService } from './relationships/relationships.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';
import { NotesController } from './notes/notes.controller';
import { NotesService } from './notes/notes.service';
import { TimelineController } from './timeline/timeline.controller';
import { TimelineService } from './timeline/timeline.service';
import { TimelineEventRecorder } from './timeline/timeline-recorder';
import { ChannelIdentitiesController } from './channel-identities/channel-identities.controller';
import { ChannelIdentitiesService } from './channel-identities/channel-identities.service';
import { CrmSearchController } from './search/search.controller';
import { CrmSearchService } from './search/search.service';
import { DuplicatesController } from './duplicates/duplicates.controller';
import { DuplicatesService } from './duplicates/duplicates.service';
import { CrmCsvController } from './csv/crm-csv.controller';
import { CrmCsvService } from './csv/crm-csv.service';
import { MembershipsController } from './memberships/memberships.controller';
import { CrmContextController } from './crm-context.controller';

/**
 * Core CRM feature boundary (PRD-001, CRM-05/CRM-06 API slices).
 *
 * Owns the tenant CRM tenant-database schema, the Organization, Person,
 * Relationship and Employee API slices and their audit wiring. Every route
 * requires IdentityAuthGuard + TenantContextGuard: the TenantContext is
 * resolved server-side only and determines the single tenant database the
 * request may touch. Supporting CRM features share this boundary and the
 * same server-derived TenantContext as the core entity APIs. Inbox
 * (PRD-002) reuses the SAME tenant-database boundary: CoreCrmModule
 * re-exports `TenantCrmDatabase` so the Inbox routes its persistence
 * through the identical TenantContext-resolved registry, with no duplicate
 * database/security provider introduced.
 */
@Module({
  imports: [PlatformCoreModule],
  controllers: [
    OrganizationsController,
    PeopleController,
    RelationshipsController,
    EmployeesController,
    TagsController,
    NotesController,
    TimelineController,
    ChannelIdentitiesController,
    CrmSearchController,
    DuplicatesController,
    CrmCsvController,
    MembershipsController,
    CrmContextController,
  ],
  providers: [
    TenantCrmDatabase,
    CrmAuditWriter,
    OrganizationsService,
    PeopleService,
    RelationshipsService,
    EmployeesService,
    TagsService,
    NotesService,
    TimelineService,
    TimelineEventRecorder,
    ChannelIdentitiesService,
    CrmSearchService,
    DuplicatesService,
    CrmCsvService,
  ],
  exports: [TenantCrmDatabase],
})
export class CoreCrmModule {}
