export type Person = { id: string; name: string; email?: string | null; phone?: string | null };
export type Organization = { id: string; legalName: string; tradeName?: string | null; taxId?: string | null };
export type Conversation = {
  id: string; subject: string; status: "open" | "pending" | "resolved";
  assignedTo?: string | null; handoff?: "bot" | "human";
  channel: string; crmPersonId?: string | null; updatedAt?: string;
};
export type Message = {
  id: string; body: string; direction: string; createdAt?: string; authorId?: string;
};
export type CrmNote = { id: string; body: string; createdAt: string; createdBy: string };
export type CrmTag = { id: string; label: string };
export type CrmTimelineEvent = { id: number; action: string; recordedAt: string; actorId: string };
export type QueueFilter = "all" | "mine" | "unassigned";
export type InboxMetrics = { open: number; pending: number; resolved: number; unassigned: number };

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export class TenantApi {
  private readonly tenantId: string;
  private readonly token: string;
  private readonly unauthorized: () => void;
  constructor(tenantId: string, token: string, unauthorized: () => void) {
    this.tenantId = tenantId;
    this.token = token;
    this.unauthorized = unauthorized;
  }

  private async request<T>(module: "crm" | "inbox", path: string, method = "GET", body?: object): Promise<T> {
    const response = await fetch(
      "/v1/tenants/" + encodeURIComponent(this.tenantId) + "/" + module + path,
      { method, headers: {
          Authorization: "Bearer " + this.token,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
      },
    );
    if (response.status === 401) this.unauthorized();
    if (!response.ok) {
      const detail: unknown = await response.json().catch(() => null);
      const message = (detail as { message?: unknown } | null)?.message;
      throw new ApiError(response.status,
        response.status === 403 ? "Você não tem permissão para esta ação." :
        response.status === 401 ? "Sessão expirada. Entre novamente." :
        typeof message === "string" ? message : "Erro na operação (" + response.status + ").");
    }
    return (await response.json()) as T;
  }

  people(query = "") {
    return this.request<Person[]>("crm", "/people?limit=100&q=" + encodeURIComponent(query));
  }
  organizations(query = "") {
    return this.request<Organization[]>("crm", "/organizations?limit=100&q=" + encodeURIComponent(query));
  }
  person(id: string) {
    return this.request<Person>("crm", "/people/" + encodeURIComponent(id));
  }
  personNotes(id: string) {
    return this.request<CrmNote[]>("crm", "/people/" + encodeURIComponent(id) + "/notes");
  }
  personTimeline(id: string) {
    return this.request<CrmTimelineEvent[]>("crm", "/people/" + encodeURIComponent(id) + "/timeline");
  }
  personOrganizations(id: string) {
    return this.request<Organization[]>("crm", "/people/" + encodeURIComponent(id) + "/organizations");
  }
  personTags(id: string) {
    return this.request<CrmTag[]>("crm", "/people/" + encodeURIComponent(id) + "/tags");
  }
  createPerson(body: { name: string; email?: string; phone?: string }) {
    return this.request<Person>("crm", "/people", "POST", body);
  }
  createOrganization(body: { legalName: string; tradeName?: string }) {
    return this.request<Organization>("crm", "/organizations", "POST", body);
  }
  conversations(status = "", queue: QueueFilter = "all") {
    return this.request<Conversation[]>("inbox", "/conversations?limit=100"
      + (status ? "&status=" + encodeURIComponent(status) : "")
      + "&queue=" + queue);
  }
  metrics() { return this.request<InboxMetrics>("inbox", "/metrics"); }
  conversation(id: string) { return this.request<Conversation>("inbox", "/conversations/" + encodeURIComponent(id)); }
  messages(id: string) { return this.request<Message[]>("inbox", "/conversations/" + encodeURIComponent(id) + "/messages"); }
  createConversation(body: { subject: string; crmPersonId?: string | null }) {
    return this.request<Conversation>("inbox", "/conversations", "POST", body);
  }
  message(id: string, path: "replies" | "notes" | "simulator/inbound", body: { body: string; externalMessageId?: string }) {
    return this.request<Message>("inbox", "/conversations/" + encodeURIComponent(id) + "/" + path, "POST", body);
  }
  setStatus(id: string, status: Conversation["status"]) {
    return this.request<Conversation>("inbox", "/conversations/" + encodeURIComponent(id) + "/status", "PATCH", { status });
  }
  setAssignment(id: string, assigneeId: string | null) {
    return this.request<Conversation>("inbox", "/conversations/" + encodeURIComponent(id) + "/assignment", "PATCH", { assigneeId });
  }
  setHandoff(id: string, mode: "human" | "bot") {
    return this.request<Conversation>("inbox", "/conversations/" + encodeURIComponent(id) + "/handoff", "PATCH", { mode });
  }
}
