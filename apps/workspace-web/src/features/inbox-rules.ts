import type { Conversation } from "@/lib/api";

// These checks improve UX only. Every mutation is authorized again by the Core Host.
export function replyBlockReason(conversation: Conversation | null, actorId: string): string | null {
  if (!conversation) return "Selecione uma conversa.";
  if (conversation.status === "resolved") return "Reabra a conversa para responder ou registrar notas.";
  if (conversation.handoff !== "human") return "Transfira o atendimento do bot para um atendente.";
  if (!actorId) return "Sua identidade de atendente não está disponível.";
  if (conversation.assignedTo !== actorId) return "Assuma a conversa antes de responder ou adicionar notas.";
  return null;
}

export function isMine(conversation: Conversation | null, actorId: string): boolean {
  return Boolean(conversation && actorId && conversation.assignedTo === actorId);
}
