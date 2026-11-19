/**
 * IAM07D immutable capability contract. Exact grants only; an OpenFGA
 * workspace/funnel capability is never inferred from a module or role.
 * Keep the CHECK constraint in 010_iam07d_cutover_capabilities.sql aligned.
 */
export const IAM07D_CAPABILITIES=Object.freeze([
 "inbox.conversation.claim",
 "inbox.conversation.transfer",
 "inbox.conversation.create",
 "inbox.conversation.assign",
 "inbox.conversation.status",
 "inbox.conversation.handoff",
 "inbox.conversation.favorite",
 "inbox.conversation.mark_read",
 "inbox.conversation.link_contact",
 "inbox.message.reply",
 "inbox.message.note",
 "inbox.conversation.history_sync",
 "inbox.message.simulate",
 "service.funnel.operate",
 "service.funnel.publish",
 "service.attendance.open",
 "service.attendance.assign",
 "service.attendance.team_transfer",
 "service.attendance.close"
] as const);
export type SpecificIam07dCapability=typeof IAM07D_CAPABILITIES[number];
export const iam07dIsCapability=(value:unknown):value is SpecificIam07dCapability=>
 typeof value==="string"&&(IAM07D_CAPABILITIES as readonly string[]).includes(value);
export const iam07dScopeKind=(capability:SpecificIam07dCapability):"workspace"|"funnel"=>
 ["service.funnel.operate","service.attendance.open","service.attendance.assign","service.attendance.team_transfer","service.attendance.close"].includes(capability)?"funnel":"workspace";
export const iam07dModule=(capability:SpecificIam07dCapability):"inbox"|"service"=>
 capability.startsWith("service.")?"service":"inbox";
