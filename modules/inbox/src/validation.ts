import {InboxValidationError} from "./contracts.js";
export function id(value:unknown,name="ID"):string{
 if(typeof value!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
   throw new InboxValidationError("Invalid "+name);
 return value.toLowerCase();
}
export function text(value:unknown,name:string,max=2000):string{
 if(typeof value!=="string")throw new InboxValidationError("Invalid "+name);
 const normalized=value.replace(/\r\n?/g,"\n").trim();
 if(!normalized||normalized.length>max||/[\x00-\x08\x0b-\x1f\x7f]/.test(normalized))
   throw new InboxValidationError("Invalid "+name);
 return normalized;
}
export function optionalExternal(value:unknown):string|null{
 if(value===null||value===undefined||value==="")return null;
 if(typeof value!=="string"||value.length>160||!/^[\w.:@/+-]+$/.test(value))
   throw new InboxValidationError("Invalid external reference");
 return value;
}
export function limit(value:unknown):number{
 const num=typeof value==="string" && value.trim()?Number(value):value;
 if(!Number.isInteger(num)||Number(num)<1||Number(num)>100)throw new InboxValidationError("Invalid page size");
 return Number(num);
}
export function assignee(value:unknown):string|null{
 if(value===null)return null;
 if(typeof value!=="string"||value.length>128||!/^[\w:@.-]+$/.test(value))
   throw new InboxValidationError("Invalid assignee");
 return value;
}
