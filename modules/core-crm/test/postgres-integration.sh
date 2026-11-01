#!/usr/bin/env bash
set -Eeuo pipefail
docker run -d --name syndes-crm-ci-pg -p 127.0.0.1:54329:5432 -e POSTGRES_PASSWORD=ci-only-not-production-123 postgres:17-bookworm >/dev/null
trap 'docker rm -f syndes-crm-ci-pg >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 40); do
  if docker exec syndes-crm-ci-pg pg_isready -U postgres -d postgres >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == 40 ]]; then echo "CRM SQL DB not ready" >&2; exit 1; fi
  sleep 2
done
docker exec -i syndes-crm-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < modules/core-crm/sql/001_crm_foundation.sql >/dev/null
docker exec -i syndes-crm-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < modules/core-crm/sql/002_crm_tags_notes.sql >/dev/null
docker exec -i syndes-crm-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < modules/core-crm/sql/003_crm_employees_channels.sql >/dev/null
# Migrations must also be safe on a tenant with existing data.
docker exec -i syndes-crm-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < modules/core-crm/sql/001_crm_foundation.sql >/dev/null
docker exec -i syndes-crm-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < modules/core-crm/sql/002_crm_tags_notes.sql >/dev/null
docker exec -i syndes-crm-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres < modules/core-crm/sql/003_crm_employees_channels.sql >/dev/null

docker exec -i syndes-crm-ci-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
INSERT INTO crm_organizations (id,tenant_id,legal_name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','4ab44379-d557-4df6-a2be-d44e121a8077','Office A'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','d21930aa-f4f6-40c0-bb1a-e71d7bb92caa','Office B');
INSERT INTO crm_people(id,tenant_id,name)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','4ab44379-d557-4df6-a2be-d44e121a8077','Alice');

INSERT INTO crm_person_organizations(tenant_id,person_id,organization_id)
VALUES ('4ab44379-d557-4df6-a2be-d44e121a8077',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

DO $$
BEGIN
  BEGIN
    INSERT INTO crm_person_organizations(tenant_id,person_id,organization_id)
    VALUES ('4ab44379-d557-4df6-a2be-d44e121a8077',
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    RAISE EXCEPTION 'Unexpected cross-tenant relationship creation';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM crm_person_organizations) <> 1 THEN
    RAISE EXCEPTION 'Cross-tenant relationship was inserted';
  END IF;
  IF (SELECT count(*) FROM crm_people WHERE tenant_id='d21930aa-f4f6-40c0-bb1a-e71d7bb92caa') <> 0 THEN
    RAISE EXCEPTION 'Tenant B can see person records for A';
  END IF;
END $$;
SQL
node modules/core-crm/test/pg-repo-integration.mjs
echo "CRM PostgreSQL migrations and tenant-scoped composite FKs: PASS"
