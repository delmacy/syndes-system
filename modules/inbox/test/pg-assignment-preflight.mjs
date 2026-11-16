import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";

// PRE-DEPLOY READ-ONLY DIAGNOSTIC: seeded data are isolated in a transaction
// rolled back unconditionally. No production DSN or automatic cleanup writes.
const require=createRequire(new URL("../../../apps/core-host/package.json",import.meta.url));
const {Client}=require("pg");
const uri=process.env.SYNDES_INBOX_SCOPE_TEST_PG_URL;
const allowed=(()=>{try{const u=new URL(uri);return u.hostname==="127.0.0.1"&&u.port==="54339"&&u.pathname==="/postgres"&&u.username==="postgres"}catch{return false}})();

export const assignmentAuditSQL=`
WITH assessed AS (
 SELECT
   CASE
    WHEN c.platform_organization_id IS NULL OR c.platform_current_workspace_id IS NULL THEN 'missing_scope'
    WHEN o.id IS NULL OR o.status<>'active' THEN 'organization_inactive'
    WHEN w.id IS NULL OR w.status<>'active' THEN 'workspace_inactive'
    WHEN om.principal_id IS NULL OR om.state<>'active' THEN 'org_membership_inactive'
    WHEN wm.principal_id IS NULL OR wm.state<>'active' THEN 'workspace_membership_inactive'
    WHEN om.role NOT IN ('admin','editor') OR wm.role NOT IN ('admin','editor') THEN 'read_only_role'
    ELSE 'eligible_by_membership'
   END AS reason
 FROM inbox_conversations c
 LEFT JOIN platform_organizations o
   ON o.tenant_id=c.tenant_id AND o.id=c.platform_organization_id
 LEFT JOIN platform_workspaces w
   ON w.tenant_id=c.tenant_id AND w.organization_id=c.platform_organization_id
      AND w.id=c.platform_current_workspace_id
 LEFT JOIN platform_org_memberships om
   ON om.tenant_id=c.tenant_id AND om.organization_id=c.platform_organization_id
      AND om.principal_id=c.assigned_to
 LEFT JOIN platform_workspace_memberships wm
   ON wm.tenant_id=c.tenant_id AND wm.organization_id=c.platform_organization_id
      AND wm.workspace_id=c.platform_current_workspace_id
      AND wm.principal_id=c.assigned_to
 WHERE c.tenant_id=$1::uuid AND c.assigned_to IS NOT NULL
)
SELECT reason,count(*)::integer AS total FROM assessed GROUP BY reason ORDER BY reason`;

const readinessSQL=`
SELECT
 EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
           AND indexname='platform_legacy_single_organization') AS single_org_gate,
 EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
           AND indexname='platform_legacy_single_workspace') AS single_workspace_gate,
 EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema=current_schema() AND table_name='inbox_conversations'
            AND column_name='platform_organization_id') AS organization_column,
 EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema=current_schema() AND table_name='inbox_conversations'
            AND column_name='platform_current_workspace_id') AS workspace_column,
 EXISTS (SELECT 1 FROM platform_legacy_backfill_runs WHERE tenant_id=$1::uuid) AS backfill_receipt`;

test("P02-ASSIGN preflight: migration gates and existing invalid assignees, no repair",{
 skip:!allowed&&"requires explicitly disposable localhost PostgreSQL"
},async()=>{
 const c=new Client({connectionString:uri});
 await c.connect();
 const tenant=randomUUID(),org=randomUUID(),ws=randomUUID();
 let tx=false;
 const add=async(assignedTo,scope=ws)=>{
  const key=randomUUID();
  await c.query(`INSERT INTO inbox_conversations
  (tenant_id,id,subject,channel,assigned_to,platform_organization_id,
   platform_origin_workspace_id,platform_current_workspace_id)
   VALUES ($1,$2,'Synthetic legacy assignment','simulation',$3,$4,$5,$6)`,
   [tenant,key,assignedTo,org,ws,scope]);
  return key;
 };
 try{
  await c.query("BEGIN");tx=true;
  await c.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Preflight',true)",[tenant,org]);
  await c.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Desk','desk',true)",[tenant,ws,org]);
  const members=[
   ["eligible","editor","active","editor","active"],
   ["viewer","viewer","active","viewer","active"],
   ["org-revoked","editor","revoked","editor","active"],
   ["workspace-revoked","editor","active","editor","revoked"]
  ];
  for(const [principal,orgRole,orgState,wsRole,wsState] of members){
   await c.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role,state) VALUES($1,$2,$3,$4,$5)",[tenant,org,principal,orgRole,orgState]);
   await c.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role,state) VALUES($1,$2,$3,$4,$5,$6)",[tenant,org,ws,principal,wsRole,wsState]);
  }
  for(const principal of ["eligible","viewer","org-revoked","workspace-revoked","missing"])
   await add(principal);
  await add(null);
  const before=await c.query(readinessSQL,[tenant]);
  assert.equal(before.rows[0].single_org_gate,true);
  assert.equal(before.rows[0].single_workspace_gate,true);
  assert.equal(before.rows[0].organization_column,true);
  assert.equal(before.rows[0].workspace_column,true);
  assert.equal(before.rows[0].backfill_receipt,false,"Missing backfill must be detected");
  const original=(await c.query("SELECT id,assigned_to FROM inbox_conversations WHERE tenant_id=$1 ORDER BY id",[tenant])).rows;
  const report=(await c.query(assignmentAuditSQL,[tenant])).rows;
  const totals=Object.fromEntries(report.map(({reason,total})=>[reason,total]));
  assert.deepEqual(totals,{
   eligible_by_membership:1,org_membership_inactive:2,read_only_role:1,
   workspace_membership_inactive:1

  }); // Unknown + revoked organization memberships have the same safe classification.
  assert.equal(report.reduce((n,row)=>n+row.total,0),5,"Only non-null assignments are assessed");
  const after=(await c.query("SELECT id,assigned_to FROM inbox_conversations WHERE tenant_id=$1 ORDER BY id",[tenant])).rows;
  assert.deepEqual(after,original,"Diagnostic may never change assignments");
  await c.query("INSERT INTO platform_legacy_backfill_runs(tenant_id,organization_id,actor_id,counts) VALUES($1,$2,'ci-preflight','{}'::jsonb)",[tenant,org]);
  const ready=(await c.query(readinessSQL,[tenant])).rows[0];
  assert.equal(ready.backfill_receipt,true,"Receipt presence is necessary, not acceptance of restore");
  const archived=await c.query("UPDATE platform_workspaces SET status='archived' WHERE tenant_id=$1 AND id=$2",[tenant,ws]);
  assert.equal(archived.rowCount,1);
  const reportArchived=(await c.query(assignmentAuditSQL,[tenant])).rows;
  assert.deepEqual(reportArchived,[{reason:"workspace_inactive",total:5}]);
  console.log("INBOX_ASSIGNMENT_PREFLIGHT",JSON.stringify({rows:5,eligible:1,invalid:4,backfillGate:true,mutation:"none; rollback"}));
 }finally{
  if(tx)await c.query("ROLLBACK");
  await c.end();
 }
});
