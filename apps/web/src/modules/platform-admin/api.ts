export interface PlatformTenant {
  id: string;
  displayName: string;
  provisioningState: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDetail extends PlatformTenant {
  provisioning: {
    stage: string | null;
    failureCode: string | null;
    attempt: number | null;
  };
}

export async function managerRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`/api/backend/platform-admin${normalizedPath}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const code =
      typeof record.code === "string" ? record.code : `http_${response.status}`;
    throw new Error(code);
  }
  return payload as T;
}

export function managerErrorMessage(code: string): string {
  if (
    code === "http_401" ||
    code === "http_403" ||
    code === "forbidden" ||
    code === "unauthorized"
  )
    return "Sua conta não tem acesso ao Platform Admin.";
  if (code === "API unavailable" || code === "http_502" || code === "http_503")
    return "Serviço temporariamente indisponível.";
  if (code === "http_409")
    return "A operação conflita com o estado atual do tenant.";
  return "Não foi possível concluir a operação. Revise os dados e tente novamente.";
}
