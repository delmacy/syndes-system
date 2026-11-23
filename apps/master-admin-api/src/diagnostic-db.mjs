// One-shot, read-only diagnostic executed only by the approved deploy job.
// No credentials, network addresses, SQL details or raw errors reach logs.
import {readFileSync} from "node:fs";
import pg from "pg";

function classify(error){
 const code=typeof error?.code==="string"&&/^[A-Z0-9_]{3,40}$/.test(error.code)?error.code:"INVARIANT";
 const syscall=["connect","open","read","stat","access","getaddrinfo"].includes(error?.syscall)?error.syscall:"other";
 return code+":"+syscall;
}
let stage="file";
let pool;
try{
 const path=process.env.MASTER_CONTROL_DB_URL_FILE;
 if(path!=="/run/secrets/master_db_url")throw Error("Unapproved secret path");
 const url=readFileSync(path,"utf8").trim();
 if(!url)throw Error("Empty URL");
 // Identical pg client settings to the production Manager startup.
 stage="control-sql";
 pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:3000,
  statement_timeout:5000,options:"-c default_transaction_read_only=on"});
 const {rows}=await pool.query("SELECT current_database() AS db,current_user AS role");
 if(rows.length!==1||rows[0].db!=="syndes_control"||rows[0].role!=="syndes_master_api")
  throw Error("Unexpected DB identity");
 console.log("MANAGER_DB_PROBE=PASS");
}catch(error){
 console.error("MANAGER_DB_PROBE=BLOCKED:"+stage+":"+classify(error));
 process.exitCode=1;
}finally{
 if(pool)await pool.end().catch(()=>{});
}
