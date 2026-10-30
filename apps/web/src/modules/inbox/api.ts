export type InboxConversationStatus = "open" | "pending" | "resolved";
export type InboxChannel = "whatsapp" | "email" | "unknown";

export type InboxMessageKind = "inbound" | "outgoing" | "note" | "system";

export interface InboxAuthor {
  role: "agent" | "customer" | "system";
  name?: string | null;
  actorId?: string | null;
}

export interface InboxMessage {
  id: string;
  kind: InboxMessageKind;
  content: string;
  author?: InboxAuthor | null;
  createdAt: string;
  status?: string;
  retryCount?: number;
}

export interface InboxQueueItem {
  id: string;
  subject: string;
  preview: string;
  status: InboxConversationStatus;
  unreadCount?: number;
  assigneeActorId?: string | null;
  channel?: InboxChannel;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboxConversation {
  id: string;
  subject?: string | null;
  status: InboxConversationStatus;
  unreadCount?: number;
  lastActivity?: string;
  assigneeActorId?: string | null;
  messages?: InboxMessage[];
}

export interface InboxAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  conversationId?: string;
}

export interface InboxAttachmentMutationResult {
  success: boolean;
  attachment?: InboxAttachment;
  error?: string;
}

export interface InboxMutationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface InboxNoteResult {
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface InboxQueuePage {
  items: InboxQueueItem[];
  page: number;
  pageSize: number;
  total: number;
}

const BFF_INBOX_PREFIX = "/api/backend/inbox";

/**
 * Thin client for the authenticated BFF proxy of the Inbox contracts
 * (`/api/backend/inbox/*` -> `/api/v1/inbox/*`). The BFF resolves the tenant
 * from the server-side session and never forwards client tenant selectors.
 */
export async function inboxRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = normalizedPath.startsWith(BFF_INBOX_PREFIX)
    ? normalizedPath
    : `${BFF_INBOX_PREFIX}${normalizedPath}`;

  const body = init?.body;
  const isMultipart =
    typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(isMultipart
        ? {}
        : {
            "Content-Type": "application/json",
          }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const errorData: unknown = await response.json();
      if (
        errorData &&
        typeof errorData === "object" &&
        "code" in errorData &&
        typeof (errorData as { code?: unknown }).code === "string"
      ) {
        code = (errorData as { code: string }).code;
      }
    } catch {
      /* error body is intentionally not surfaced to users */
    }
    throw new Error(code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function inboxErrorMessage(code: string): string {
  if (code === "http_401") return "Sua sessão expirou. Entre novamente.";
  if (
    code === "http_403" ||
    code === "forbidden" ||
    code === "unauthorized"
  )
    return "Sua conta não tem permissão para esta operação.";
  if (code === "http_404") return "Conversa não encontrada.";
  if (
    code === "API unavailable" ||
    code === "http_502" ||
    code === "http_503" ||
    code.startsWith("http_5")
  )
    return "Serviço temporariamente indisponível.";
  if (code === "http_409") return "A operação conflita com o estado atual.";
  return "Não foi possível concluir. Revise os dados e tente novamente.";
}

export const INBOX_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const INBOX_ATTACHMENT_ALLOWED_TYPES: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
  "text/plain": ["txt"],
  "text/csv": ["csv"],
};

export function isInboxAttachmentAllowed(file: File): boolean {
  if (file.size > INBOX_ATTACHMENT_MAX_BYTES) return false;
  const allowedExtensions = INBOX_ATTACHMENT_ALLOWED_TYPES[file.type];
  if (!allowedExtensions) return false;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return allowedExtensions.includes(extension);
}
