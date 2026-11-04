/** Message reconciliation must never erase cached history merely because
 *  a provider receipt refreshed the same list. Pure, separately unit-tested. */
export function reconcileInboxThread<T extends {id:string}>(
 previous:readonly T[],latest:readonly T[]):readonly T[]{
 if(previous.length!==latest.length)return latest;
 for(let i=0;i<previous.length;i++){
  const a=previous[i] as Record<string,unknown>,b=latest[i] as Record<string,unknown>;
  const keys=Object.keys(a);
  if(a.id!==b.id||keys.length!==Object.keys(b).length||
     keys.some(key=>!Object.prototype.hasOwnProperty.call(b,key)||!Object.is(a[key],b[key]))){
   return latest;
  }
 }
 return previous;
}
