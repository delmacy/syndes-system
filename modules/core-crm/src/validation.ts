import { CrmValidationError } from "./contracts.js";
export const isUuid=(value:unknown):value is string=>
  typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function requiredName(input:unknown,label:string):string {
  if(typeof input!=="string")throw new CrmValidationError(label+" must be text");
  const value=input.trim().replace(/\s+/g," ");
  if(!value||value.length>160||/[\x00-\x1f\x7f]/.test(value))throw new CrmValidationError("Invalid "+label);
  return value;
}
export function optionalText(input:unknown,label:string,max:number):string|null {
  if(input===null||input===undefined||input==="")return null;
  if(typeof input!=="string")throw new CrmValidationError(label+" must be text");
  const value=input.trim();
  if(!value)return null;
  if(value.length>max||/[\x00-\x1f\x7f]/.test(value))throw new CrmValidationError("Invalid "+label);
  return value;
}
export function email(input:unknown):string|null {
  const value=optionalText(input,"email",254)?.toLowerCase()??null;
  if(value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new CrmValidationError("Invalid email");
  return value;
}
export function phone(input:unknown):string|null {
  const value=optionalText(input,"phone",32);
  if(value===null)return null;
  const digits=value.replace(/[^\d]/g,"");
  if(digits.length<10||digits.length>15)throw new CrmValidationError("Invalid phone");
  return "+"+digits;
}
export function taxId(input:unknown):string|null {
  const value=optionalText(input,"tax ID",32);
  if(value===null)return null;
  const digits=value.replace(/\D/g,"");
  if(digits.length!==11&&digits.length!==14)throw new CrmValidationError("Invalid CPF/CNPJ length");
  return digits;
}
export function searchQuery(input:unknown):string|null {
  const value=optionalText(input,"search query",100);
  return value?.replace(/[\\%_]/g,s=>"\\"+s)??null;
}
export function id(value:unknown,label:string):string {
  if(!isUuid(value))throw new CrmValidationError("Invalid "+label);
  return value;
}
