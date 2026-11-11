/** AK-20/AK-30 administrative inventory.
 *
 * The Manager receives Control Plane metadata only: no SQL receipts, DB roles,
 * database names, tenant connections, FGA tuples or secrets.
 *
 * This is intentionally read-only. Catalog availability is NOT execution
 * authorization, and the Control DB's installation receipt does not prove
 * runtime enablement (AK-10.04 is a separate security gate).
 */
export async function readTenantModuleInventory(pool,tenantId){
 const tenant=await pool.query(
  "SELECT tenant_id::text AS id,state FROM public.tenant_registry WHERE tenant_id=$1::uuid LIMIT 1",
  [tenantId]);
 if(!tenant.rows[0])return null;
 const data=await pool.query(
  "SELECT c.module_id,c.schema_name,"+
  " COALESCE((SELECT jsonb_agg(v.version ORDER BY v.version)"+
  " FROM public.module_catalog_versions v"+
  " WHERE v.module_id=c.module_id AND v.approved=TRUE),'[]'::jsonb) AS approved_versions,"+
  " e.state AS entitlement_state,"+
  " (e.state='granted' AND (e.valid_until IS NULL OR e.valid_until>clock_timestamp())) AS entitlement_current,"+
  " e.valid_until,"+
  " i.state AS installation_state,i.target_version,i.installed_version,i.verified_at"+
  " FROM public.module_catalog c"+
  " LEFT JOIN public.tenant_module_entitlements e"+
  " ON e.tenant_id=$1::uuid AND e.module_id=c.module_id"+
  " LEFT JOIN public.tenant_module_installs i"+
  " ON i.tenant_id=$1::uuid AND i.module_id=c.module_id"+
  " ORDER BY c.module_id", [tenantId]);
 const items=data.rows.map(row=>{
  if(typeof row.module_id!=="string"||typeof row.schema_name!=="string"||
     !Array.isArray(row.approved_versions)||
     row.approved_versions.some(x=>typeof x!=="string")||
     (row.entitlement_state!==null&&!["granted","suspended","revoked"].includes(row.entitlement_state))||
     (row.entitlement_state!==null&&typeof row.entitlement_current!=="boolean")||
     (row.installation_state!==null&&!["requested","installed","enabled","suspended","retired"].includes(row.installation_state))){
   throw Error("Invalid Control DB module inventory");
  }
  return {
   moduleId:row.module_id,
   approvedVersions:row.approved_versions,
   entitlementState:row.entitlement_state,
   entitled:row.entitlement_state==="granted"&&row.entitlement_current===true,
   validUntil:row.valid_until?new Date(row.valid_until).toISOString():null,
   installationState:row.installation_state,
   targetVersion:row.target_version,
   installedVersion:row.installed_version,
   verifiedAt:row.verified_at?new Date(row.verified_at).toISOString():null,
   // Do not expose schema/database identifiers or the receipt digest.
  };
 });
 return {tenantId:tenant.rows[0].id,tenantStatus:tenant.rows[0].state,items};
}
