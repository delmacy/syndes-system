// Drafts are local React state only; they never enter localStorage/sessionStorage.
export type ComposerMode = "replies" | "notes" | "simulator/inbound";
export function draftKey(conversationId: string, mode: ComposerMode): string {
  return conversationId + ":" + mode;
}
export function setDraft(drafts: Readonly<Record<string,string>>, key: string, body: string): Record<string,string> {
  if (!body) {
    const next = {...drafts}; delete next[key]; return next;
  }
  return { ...drafts, [key]: body };
}
export function clearSentDraft(drafts: Readonly<Record<string,string>>, key: string, sentBody: string): Record<string,string> {
  // Never erase new typing if the request resolved after the operator edited a draft.
  if (drafts[key] !== sentBody) return {...drafts};
  return setDraft(drafts,key,"");
}
