export async function crmRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`/api/backend/crm${normalizedPath}`, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string" && !init.headers
        ? { "content-type": "application/json" }
        : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const result: unknown = await response.json();
      if (
        result &&
        typeof result === "object" &&
        "code" in result &&
        typeof result.code === "string"
      )
        code = result.code;
    } catch {
      /* error body is intentionally not surfaced to users */
    }
    throw new Error(code);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv")) return (await response.text()) as T;
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function crmErrorMessage(code: string): string {
  if (code === "http_401") return "Sua sessão expirou. Entre novamente.";
  if (
    code === "http_403" ||
    code === "export_admin_only" ||
    code === "customer_scope_denied"
  )
    return "Sua conta não tem permissão para esta operação.";
  if (code === "http_404")
    return "O registro não está disponível no seu escopo.";
  if (code.startsWith("http_5")) return "Serviço temporariamente indisponível.";
  return "Não foi possível concluir. Revise os dados e tente novamente.";
}

export interface CrmRecord {
  id: string;
  fullName?: string;
  name?: string;
  cpf?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  displayName?: string;
  controlPlaneActorId?: string | null;
  active?: boolean;
  [key: string]: unknown;
}
