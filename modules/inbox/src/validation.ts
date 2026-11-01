import {InboxValidationError} from "./contracts.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(v:unknown,label:string):string{
 if(typeof v!=="string"||!UUID.test(v))throw new InboxValidationError("Invalid "+label);
 return v.toLowerCase();
}
export function bounded(v:unknown,label:string,max:number):string{
 if(typeof v!=="string")throw new InboxValidationError("Invalid "+label);
 const s=v.trim();
 if(!s||s.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s))
   throw new InboxValidationError("Invalid "+label);
 return s;
}
export function channel(v:unknown):string{
 if(v!=="whatsapp"&&v!=="email"&&v!=="internal")throw new InboxValidationError("Invalid channel");
 return v;
}
export function pageSize(v:unknown,fallback:number,max=100):number{
 if(v===undefined||v===null||v==="")return fallback;
 const n=Number(v);
 if(!Number.isSafeInteger(n)||n<1||n>max)throw new InboxValidationError("Invalid page size");
 return n;
}
export function cursor(v:unknown):number{
 if(v===undefined||v===null||v==="")return 0;
 const n=Number(v);
 if(!Number.isSafeInteger(n)||n<0)throw new InboxValidationError("Invalid event cursor");
 return n;
}
