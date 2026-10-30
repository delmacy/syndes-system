export type WhatsAppConnectionStatus =
  "disconnected" | "pairing" | "connected" | "suspended" | "error";

export interface WhatsAppConnection {
  id?: string;
  provider: "whatsmeow" | "fake";
  status: WhatsAppConnectionStatus;
  phoneExternalId: string | null;
  configured?: boolean;
  authorized?: boolean;
  serviceEnabled?: boolean;
  suspensionReason?: "delinquency" | null;
  updatedAt: string | null;
}

export interface WhatsAppPairing {
  pairingCode: string;
  expiresAt: string;
}

export async function whatsappRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `/api/backend/whatsapp${path.startsWith("/") ? path : `/${path}`}`,
    {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    },
  );
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const body = (await response.json()) as { code?: unknown };
      if (typeof body.code === "string") code = body.code;
    } catch {
      // Deliberately do not surface provider or secret-bearing response bodies.
    }
    throw new Error(code);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function whatsappErrorMessage(code: string): string {
  if (code === "http_401") return "Sua sessão expirou. Entre novamente.";
  if (code === "http_403" || code === "forbidden")
    return "Somente administradores do tenant podem gerenciar esta conexão.";
  if (code === "http_409")
    return "A conexão já está em uso ou mudou de estado.";
  if (code.startsWith("http_5") || code === "API unavailable")
    return "O serviço WhatsApp está temporariamente indisponível.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
