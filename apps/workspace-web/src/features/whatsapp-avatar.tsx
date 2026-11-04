import {useEffect,useRef,useState} from "react";
import {MessageCircle,Users} from "lucide-react";
import type {TenantApi} from "@/lib/api";

// Per-session bounded cache; no browser localStorage of customer pictures.
// Distinct API instances correspond to separately authenticated sessions.
const avatarCache=new WeakMap<TenantApi,Map<string,{value:string|null;expires:number}>>();
const pending=new WeakMap<TenantApi,Map<string,Promise<string|null>>>();
const CACHE_TTL_MS=10*60*1000;
const NEGATIVE_TTL_MS=60*1000;
function cacheFor(api:TenantApi){
 let cached=avatarCache.get(api);
 if(!cached){cached=new Map();avatarCache.set(api,cached)}
 return cached;
}
export async function loadWhatsAppAvatar(api:TenantApi,id:string):Promise<string|null>{
 const cache=cacheFor(api),cached=cache.get(id);
 if(cached&&cached.expires>Date.now())return cached.value;
 let queue=pending.get(api);
 if(!queue){queue=new Map();pending.set(api,queue)}
 const current=queue.get(id);
 if(current)return current;
 const task=api.whatsappAvatar(id).then(result=>{
  const value=result.available&&result.imageData?.startsWith("data:image/")?result.imageData:null;
  if(cache.size>=250)cache.delete(cache.keys().next().value!);
  cache.set(id,{value,expires:Date.now()+(value?CACHE_TTL_MS:NEGATIVE_TTL_MS)});
  return value;
 }).catch(()=>{
  cache.set(id,{value:null,expires:Date.now()+NEGATIVE_TTL_MS});
  return null;
 }).finally(()=>queue!.delete(id));
 queue.set(id,task);
 return task;
}
export function WhatsAppAvatar({api,id,isGroup,size="sm"}:{
 api:TenantApi;id:string;isGroup:boolean;size?:"sm"|"md"
}){
 const root=useRef<HTMLSpanElement|null>(null);
 const [visible,setVisible]=useState(false);
 const [image,setImage]=useState<string|null>(null);
 useEffect(()=>{
  const node=root.current;
  if(!node)return;
  if(typeof IntersectionObserver==="undefined"){setVisible(true);return}
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}
  },{rootMargin:"120px"});
  observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  let live=true;
  setImage(null);
  if(visible)void loadWhatsAppAvatar(api,id).then(value=>{if(live)setImage(value)});
  return()=>{live=false};
 },[api,id,visible]);
 const Icon=isGroup?Users:MessageCircle;
 return <span ref={root} data-avatar-for={id} className={"relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-emerald-600 "+(size==="md"?"size-10":"size-9")}>
   {image?<img src={image} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer"/>:<Icon className="size-5" aria-hidden="true"/>}
 </span>;
}
