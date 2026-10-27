# Syndes API (`apps/api`)

NestJS modular monolith for the Syndes backend. The current slice establishes the Control Plane tenant-registry schema and its migration path. CRM behavior, runtime persistence providers, authentication, tenant provisioning, and API contracts are not implemented yet.

## Layout

```text
apps/api/
  src/
    main.ts
    app.module.ts          # root module; imports PlatformCoreModule and CoreCrmModule
    modules/
      platform-core/       # Control Plane tenant schema; runtime module is still a shell
      core-crm/             # Core CRM feature boundary (empty module shell)
  drizzle/control-plane/   # reviewed Control Plane SQL migrations and journal
  scripts/                 # separate release migration command
```

## Scaffold notes

- Created with `@nestjs/cli@11` (`nest new` + `--strict` + npm).
- TypeScript uses Nest's strict flag set (`strictNullChecks`, `noImplicitAny`, etc.).
- Dependencies are frozen in `package-lock.json` (lockfileVersion 3).
- `PlatformCoreModule` and `CoreCrmModule` are registered on `AppModule` as separate module boundaries.
- Drizzle ORM and `pg` are selected for PostgreSQL access. The Control Plane schema is separate from tenant databases.
- Control Plane migrations use Drizzle's PostgreSQL migrator as a separate release step; no migration runs at API startup.
- `overrides.multer` pins `multer@2.5.0` to address the high-severity advisory in the Nest Express adapter dependency tree; recheck this override when upgrading NestJS.

## Remaining technical decisions

- Authentication/session integration and the `AuthenticatedActor` / `TenantContext` contract.
- Tenant database provisioning and routing lifecycle; set pool limits from measured load.
- API versioning, authorization rules, CSV limits, and error shape.
- Next.js App Router frontend is approved and separate from this package; its session integration remains to be specified.

## Commands

```bash
npm ci
npm run start
npm run start:dev
npm run cp:migrations:apply
npm run cp:migrations:verify
```

`cp:migrations:apply` uses only `CONTROL_PLANE_DATABASE_URL` and applies checked-in SQL files through Drizzle's PostgreSQL migrator. Run it as a separate release step, never as part of API startup. New migration SQL and its Drizzle journal entry must be reviewed and versioned together.

`cp:migrations:verify` is the migration contract proof used by the API workflow after applying migrations against the disposable PostgreSQL 16 service. It requires a disposable database and is not intended for production URLs. It confirms: (1) migrations apply from an empty database with the expected `provisioning_state` enum, `tenants` table, columns and `tenants_database_name_unique` constraint; (2) reapplying the migrator leaves the catalog objects unchanged and the journal at one applied migration; (3) an insert probe checks the `pending` default and then rolls back. It never persists or prints connection credentials.

Do not treat a successful start as Core CRM delivery; domain work starts in later work packages.
