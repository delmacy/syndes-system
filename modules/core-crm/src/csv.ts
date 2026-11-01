import {CrmValidationError,type CreatePerson,type Person} from "./contracts.js";
import {email,phone,requiredName} from "./validation.js";

/** RFC4180-style small CSV parser. Strict limits prevent huge imports/CSV bombs. */
export function parseContactsCsv(csv:unknown):readonly CreatePerson[]{
  if(typeof csv!=="string"||Buffer.byteLength(csv,"utf8")>1024*1024)
    throw new CrmValidationError("CSV must be at most 1 MiB");
  const source=csv.replace(/^\uFEFF/,"");
  const rows:string[][]=[];let field="";let cells:string[]=[];let quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){
      if(ch==='"'&&source[i+1]==='"'){field+='"';i++;}
      else if(ch==='"'){quoted=false;if(source[i+1]&&![",","\n","\r"].includes(source[i+1]!))throw new CrmValidationError("Invalid CSV quoting");}
      else field+=ch;
    }else if(ch==='"'){
      if(field)throw new CrmValidationError("Unexpected quote");
      quoted=true;
    }else if(ch===","){cells.push(field);field="";}
    else if(ch==="\n"||ch==="\r"){
      if(ch==="\r"&&source[i+1]==="\n")i++;
      cells.push(field);field="";
      if(cells.length>1||cells[0]?.trim())rows.push(cells);
      cells=[];if(rows.length>501)throw new CrmValidationError("CSV row limit exceeded");
    }else field+=ch;
  }
  if(quoted)throw new CrmValidationError("Unterminated CSV quote");
  if(field||cells.length){cells.push(field);rows.push(cells);}
  const header=rows.shift()?.map(x=>x.trim().toLowerCase());
  if(!header||header.join(",")!=="name,email,phone")throw new CrmValidationError("Expected CSV columns name,email,phone");
  if(rows.length<1||rows.length>500)throw new CrmValidationError("CSV must contain 1 to 500 contacts");
  const seen=new Set<string>();
  return rows.map(row=>{
    if(row.length!==3)throw new CrmValidationError("Invalid CSV column count");
    const contact={name:requiredName(row[0],"person name"),email:email(row[1]),phone:phone(row[2])};
    const key=[contact.email,contact.phone].join("|");
    if((contact.email||contact.phone)&&seen.has(key))throw new CrmValidationError("Repeated contact in CSV");
    seen.add(key);
    return contact;
  });
}

function cell(raw:string|null):string{
  let value=raw??"";
  // Neutralize spreadsheet formula injection when opening exported CSV.
  if(/^[\s\x00-\x1f]*[=+@-]/.test(value))value="'"+value;
  return '"'+value.replace(/"/g,'""')+'"';
}

export function contactsToCsv(contacts:readonly Person[]):string{
  if(contacts.length>1000)throw new CrmValidationError("CSV export exceeds 1000 contacts");
  return ["name,email,phone",...contacts.map(p=>
    [cell(p.name),cell(p.email),cell(p.phone)].join(",")
  )].join("\r\n")+"\r\n";
}
