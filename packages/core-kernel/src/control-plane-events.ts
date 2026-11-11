/** Control DB ONLY: global administrative facts, not tenant business events. */
export const controlPlaneEventTypes=Object.freeze([
 "platform.module.entitlement.changed.v1",
 "platform.module.installation.changed.v1",
] as const);
export type ControlPlaneEventType=typeof controlPlaneEventTypes[number];
export type ControlPlaneOperation=
 | "entitlement.grant"|"entitlement.suspend"|"entitlement.resume"|"entitlement.revoke"
 | "installation.request"|"installation.suspend"|"installation.resume"
 | "installation.retire"|"installation.attest"|"installation.enable"|"installation.disable";
export type ControlPlaneModuleEvent=Readonly<{
 eventId:string;
 auditEventId:string;
 tenantId:string;
 moduleId:string;
 type:ControlPlaneEventType;
 version:1;
 operation:ControlPlaneOperation;
 resultState:string;
 correlationId:string;
 payload:Readonly<{auditEventId:string}>;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[1-9][0-9]{0,18}$/;
const MAX=9223372036854775807n;
const operations:Readonly<Record<ControlPlaneEventType,readonly ControlPlaneOperation[]>>={
 "platform.module.entitlement.changed.v1":[
  "entitlement.grant","entitlement.suspend","entitlement.resume","entitlement.revoke",
 ],
 "platform.module.installation.changed.v1":[
  "installation.request","installation.suspend","installation.resume",
  "installation.retire","installation.attest","installation.enable","installation.disable",
 ],
};
/** Pure validation of the minimal Control event envelope. No actor/reason/PII. */
export function validateControlPlaneEvent(event:ControlPlaneModuleEvent):void{
 if(!event||!controlPlaneEventTypes.includes(event.type)||
    !UUID.test(event.eventId)||!UUID.test(event.tenantId)||!UUID.test(event.correlationId)||
    !/^[a-z][a-z0-9_]{0,62}$/.test(event.moduleId)||event.version!==1||
    !operations[event.type].includes(event.operation)||
    typeof event.resultState!=="string"||event.resultState.length<1||
    event.resultState.length>40||
    (event.type==="platform.module.entitlement.changed.v1"&&
      !["granted","suspended","revoked"].includes(event.resultState))||
    (event.type==="platform.module.installation.changed.v1"&&
      !["requested","installed","enabled","suspended","retired"].includes(event.resultState))||
    !ID.test(event.auditEventId)||BigInt(event.auditEventId)>MAX||
    !event.payload||Object.keys(event.payload).length!==1||
    event.payload.auditEventId!==event.auditEventId)
  throw Error("Invalid minimal Control Plane event contract");
}
