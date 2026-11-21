// Actual OpenBao raft snapshot round trip; encrypted before any disk write.
import {readFile,writeFile} from 'node:fs/promises';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
const base='https://openbao-stage:8200/v1/';
async function main(){
 if(process.env.SYNDES_STAGE_RESTORE!=='ACTIONS_STAGE_ONLY')throw Error();
 const recovery=JSON.parse(await readFile('/run/stage/bao-stage-recovery.json','utf8'));
 const key=Buffer.from((await readFile('/run/stage/backup-key','utf8')).trim(),'hex');
 if(key.length!==32||!recovery.root_token||recovery.keys_base64.length!==1)throw Error();
 const mode=process.env.VAULT_SNAPSHOT_MODE;
 if(mode==='backup'){
  const r=await fetch(base+'sys/storage/raft/snapshot',{headers:{'X-Vault-Token':recovery.root_token},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error();const data=Buffer.from(await r.arrayBuffer());if(data.length<100)throw Error();
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);
  const result=Buffer.concat([Buffer.from('SYNDESBAO1'),iv,cipher.getAuthTag(),ciphertext]);
  await writeFile('/run/runtime/bao.snapshot.enc',result,{mode:0o644});
  await writeFile('/run/runtime/bao.snapshot.sha256',createHash('sha256').update(result).digest('hex')+'\n',{mode:0o644});
  console.log('STAGE_OPENBAO_REAL_RAFT_SNAPSHOT_AES256_GCM_BACKUP_PASS');return;
 }
 if(mode!=='restore')throw Error();
 const data=await readFile('/run/runtime/bao.snapshot.enc');
 if(data.subarray(0,10).toString()!=='SYNDESBAO1')throw Error();
 const decipher=createDecipheriv('aes-256-gcm',key,data.subarray(10,22));decipher.setAuthTag(data.subarray(22,38));
 const snapshot=Buffer.concat([decipher.update(data.subarray(38)),decipher.final()]);
 const r=await fetch(base+'sys/storage/raft/snapshot',{method:'POST',headers:{'X-Vault-Token':recovery.root_token,'Content-Type':'application/octet-stream'},body:snapshot,redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error();
 for(let n=0;n<30;n++){
  try{
   const h=await fetch(base+'sys/health',{signal:AbortSignal.timeout(2000)});const health=await h.json();
   if(health.sealed){
    const u=await fetch(base+'sys/unseal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:recovery.keys_base64[0]}),signal:AbortSignal.timeout(5000)});
    if(!u.ok)throw Error();
   }else if(h.ok){console.log('STAGE_OPENBAO_ACTUAL_RAFT_SNAPSHOT_RESTORE_UNSEAL_PASS');return;}
  }catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 throw Error();
}
main().catch(()=>{console.error('STAGE_OPENBAO_SNAPSHOT_BLOCKED');process.exitCode=1});
