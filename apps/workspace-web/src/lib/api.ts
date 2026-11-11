export type PlatformOrganization={id:string;display_name:string;is_default:boolean;status:string};
export type PlatformWorkspace={id:string;organization_id:string;name:string;slug:string;is_default:boolean;status:string};
export type WorkspaceSelection={organizationId:string;workspaceId:string};
export type WhatsAppGroupInfo={
  jid:string;name:string;description:string;participantCount:number;
  canEdit:boolean;locked:boolean;announce:boolean;
};
export type WhatsAppAccount={id:string;tenantId:string;displayName:string;phoneExternalId:string|null;deviceJid:string|null;state:string;serviceEnabled:boolean};
export type Person = { id: string; name: string; email?: string | null; phone?: string | null };
export type Organization = { id: string; legalName: string; tradeName?: string | null; taxId?: string | null };
export type Conversation = {
  id: string; subject: string; status: "open" | "pending" | "resolved";
  assignedTo?: string | null; handoff?: "bot" | "human";
  channel: string; crmPersonId?: string | null; updatedAt?: string; phoneNumber?: string | null;
  displayName?:string|null;contactNameSyncStatus?:"submitted"|null;
  isGroup?:boolean;unreadCount?:number;isFavorite?:boolean;isArchived?:boolean;historySyncAt?:string|null;
};
export type Message = {
  id: string; body: string; direction: string; createdAt?: string; authorId?: string;
  deliveryStatus?: "pending"|"processing"|"sent"|"failed"|"not_queued"|"synced"|"delivered"|"read";source?:"local"|"live"|"history";
};
export type CrmNote = { id: string; body: string; createdAt: string; createdBy: string };
export type CrmCapability =
  | "people.read" | "people.write" | "organizations.read" | "organizations.write"
  | "relationships.write" | "tags.read" | "tags.write" | "notes.read" | "notes.write"
  | "employees.read" | "employees.write" | "channels.read" | "channels.write";
export type CrmCapabilities = Partial<Record<CrmCapability, boolean>>;
export type CrmEmployee = { id: string; personId: string; jobTitle: string; active: boolean };
export type CrmChannel = { id: string; channel: string; externalId: string; displayName: string | null };
export type CrmDuplicate = { id: string; name: string; reason: string };
export type CrmImportResult = { imported: number };
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
  private readonly selection?:WorkspaceSelection;
  private readonly lifetime = new AbortController();
  private readonly children = new Set<TenantApi>();
  private parent?: TenantApi;
  constructor(tenantId: string, token: string, unauthorized: () => void, selection?:WorkspaceSelection) {
    this.tenantId = tenantId;
    this.token = token;
    this.unauthorized = unauthorized;
    this.selection = selection;
  }

  /** A dedicated client for one rendered Workspace context, including legacy.
   * Do not use the directory/session client for operational module requests.
   */
  forWorkspace(selection: WorkspaceSelection | null): TenantApi {
    if (this.lifetime.signal.aborted) throw new DOMException("Sessão encerrada", "AbortError");
    const scoped = new TenantApi(this.tenantId, this.token, this.unauthorized, selection ?? undefined);
    scoped.parent = this;
    this.children.add(scoped);
    return scoped;
  }
  withScope(selection:WorkspaceSelection):TenantApi {
    return this.forWorkspace(selection);
  }
  /** Invalidate ALL in-flight responses and streams for THIS instance.
   * Aborting a mutation's HTTP request does not roll back a server-side write;
   * callers must verify its result before retrying.
   */
  dispose(): void {
    if (this.disposed) return;
    this.lifetime.abort();
    for (const child of this.children) child.dispose();
    this.children.clear();
    this.parent?.children.delete(this);
    this.parent = undefined;
  }
  get disposed(): boolean { return this.lifetime.signal.aborted; }
  private assertActive(): void {
    if (this.disposed) throw new DOMException("Contexto de Workspace encerrado", "AbortError");
  }
  private scopeHeaders():Record<string,string>{
    return this.selection?{
      "x-syndes-organization-id":this.selection.organizationId,
      "x-syndes-workspace-id":this.selection.workspaceId
    }:{};
  }
  platformOrganizations(){
    return this.request<PlatformOrganization[]>("platform","/organizations");
  }
  platformWorkspaces(organizationId:string){
    return this.request<PlatformWorkspace[]>("platform",
      "/organizations/"+encodeURIComponent(organizationId)+"/workspaces");
  }
  private async request<T>(module: "crm" | "inbox" | "whatsapp" | "platform", path: string, method = "GET", body?: object): Promise<T> {
    this.assertActive();
    const response = await fetch(
      "/v1/tenants/" + encodeURIComponent(this.tenantId) + "/" + module + path,
      { method, headers: {
          Authorization: "Bearer " + this.token,
          ...this.scopeHeaders(),
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store", signal: this.lifetime.signal,
      },
    );
    this.assertActive(); // Handles fetch mocks/transports that ignore abort.
    if (response.status === 401) this.unauthorized();
    this.assertActive();
    if (!response.ok) {
      const detail: unknown = await response.json().catch(() => null);
      this.assertActive();
      const message = (detail as { message?: unknown } | null)?.message;
      throw new ApiError(response.status,
        response.status === 403 ? "Você não tem permissão para esta ação." :
        response.status === 401 ? "Sessão expirada. Entre novamente." :
        typeof message === "string" ? message : "Erro na operação (" + response.status + ").");
    }
    const value: unknown = response.status === 204 ? null : await response.json();
    this.assertActive(); // Never release a stale body to a mounted feature.
    return value as T;
  }

  whatsappAccounts(){return this.request<WhatsAppAccount[]>("whatsapp","/accounts")}
  createWhatsAppAccount(displayName:string){return this.request<WhatsAppAccount>("whatsapp","/accounts","POST",{displayName})}
  setWhatsAppEnabled(accountId:string,enabled:boolean){
    return this.request<WhatsAppAccount>("whatsapp","/accounts/"+encodeURIComponent(accountId)+"/enabled","PATCH",{enabled});
  }
  updateWhatsAppContactName(conversationId:string,fullName:string,saveOnPrimaryAddressbook:boolean){
    return this.request<{submitted:true;confirmedOnPhone:false;fullName:string;phoneNumber:string}>("whatsapp",
      "/conversations/"+encodeURIComponent(conversationId)+"/contact-name","PATCH",
      {fullName,saveOnPrimaryAddressbook});
  }
  whatsappAvatar(conversationId:string){
    return this.request<{available:boolean;imageData?:string}>("whatsapp",
      "/conversations/"+encodeURIComponent(conversationId)+"/avatar");
  }
  whatsappGroupInfo(conversationId:string){
    return this.request<WhatsAppGroupInfo>("whatsapp","/conversations/"+encodeURIComponent(conversationId)+"/group");
  }
  updateWhatsAppGroup(conversationId:string,change:{name?:string;description?:string}){
    return this.request<WhatsAppGroupInfo>("whatsapp","/conversations/"+encodeURIComponent(conversationId)+"/group","PATCH",change);
  }
  pairWhatsAppAccount(accountId:string){return this.request<{pairingCode:string;expiresAt:string}>("whatsapp","/accounts/"+encodeURIComponent(accountId)+"/pair","POST")}
  connectWhatsAppAccount(accountId:string){return this.request<{phoneExternalId:string}>("whatsapp","/accounts/"+encodeURIComponent(accountId)+"/connect","POST")}
  disconnectWhatsAppAccount(accountId:string){return this.request<null>("whatsapp","/accounts/"+encodeURIComponent(accountId)+"/disconnect","POST")}
  people(query = "", offset = 0, limit = 100) {
    return this.request<Person[]>("crm", "/people?limit=" + limit + "&q=" + encodeURIComponent(query) + (offset ? "&offset=" + offset : ""));
  }
  organizations(query = "", offset = 0, limit = 100) {
    return this.request<Organization[]>("crm", "/organizations?limit=" + limit + "&q=" + encodeURIComponent(query) + (offset ? "&offset=" + offset : ""));
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
  crmCapabilities() { return this.request<CrmCapabilities>("crm", "/capabilities"); }
  updatePerson(id: string, body: { name: string; email?: string | null; phone?: string | null }) {
    return this.request<Person>("crm", "/people/" + encodeURIComponent(id), "PATCH", body);
  }
  archivePerson(id: string) {
    return this.request<boolean>("crm", "/people/" + encodeURIComponent(id), "DELETE");
  }
  organization(id: string) { return this.request<Organization>("crm", "/organizations/" + encodeURIComponent(id)); }
  updateOrganization(id: string, body: { legalName: string; tradeName?: string | null; taxId?: string | null }) {
    return this.request<Organization>("crm", "/organizations/" + encodeURIComponent(id), "PATCH", body);
  }
  archiveOrganization(id: string) {
    return this.request<boolean>("crm", "/organizations/" + encodeURIComponent(id), "DELETE");
  }
  linkPersonOrganization(personId: string, organizationId: string) {
    return this.request<object>("crm", "/people/" + encodeURIComponent(personId) + "/organizations", "POST", { organizationId });
  }
  createCrmNote(personId: string, body: string) {
    return this.request<CrmNote>("crm", "/people/" + encodeURIComponent(personId) + "/notes", "POST", { body });
  }
  crmAllTags() { return this.request<CrmTag[]>("crm", "/tags"); }
  unlinkPersonOrganization(personId: string, orgId: string) {
    return this.request<boolean>("crm", "/people/" + encodeURIComponent(personId) + "/organizations/" + encodeURIComponent(orgId), "DELETE");
  }
  unlinkPersonTag(personId: string, tagId: string) {
    return this.request<boolean>("crm", "/people/" + encodeURIComponent(personId) + "/tags/" + encodeURIComponent(tagId), "DELETE");
  }
  createTag(label: string) { return this.request<CrmTag>("crm", "/tags", "POST", { label }); }
  tagPerson(personId: string, tagId: string) {
    return this.request<object>("crm", "/people/" + encodeURIComponent(personId) + "/tags", "POST", { tagId });
  }
  crmChannels(personId: string) { return this.request<CrmChannel[]>("crm", "/people/" + encodeURIComponent(personId) + "/channels"); }
  linkCrmChannel(personId: string, body: { channel: string; externalId: string; displayName?: string }) {
    return this.request<CrmChannel>("crm", "/people/" + encodeURIComponent(personId) + "/channels", "POST", body);
  }
  crmPersonEmployee(personId: string) {
    return this.request<CrmEmployee | null>("crm", "/people/" + encodeURIComponent(personId) + "/employee");
  }
  crmEmployees() { return this.request<CrmEmployee[]>("crm", "/employees"); }
  createEmployee(personId: string, jobTitle: string) {
    return this.request<CrmEmployee>("crm", "/people/" + encodeURIComponent(personId) + "/employee", "POST", { jobTitle });
  }
  crmDuplicates(body: { email?: string; phone?: string; excludeId?: string }) {
    return this.request<CrmDuplicate[]>("crm", "/duplicates", "POST", body);
  }
  importPeopleCsv(csv: string) { return this.request<CrmImportResult>("crm", "/imports/csv", "POST", { csv }); }
  async exportPeopleCsv(): Promise<string> {
    this.assertActive();
    const response=await fetch("/v1/tenants/" + encodeURIComponent(this.tenantId) + "/crm/exports/csv", {
      headers:{Authorization:"Bearer " + this.token,...this.scopeHeaders()},
      cache:"no-store",signal:this.lifetime.signal,
    });
    this.assertActive();
    if(response.status===401)this.unauthorized();
    this.assertActive();
    if(!response.ok)throw new ApiError(response.status,
      response.status===403?"Você não tem permissão para exportar.":"Falha na exportação ("+response.status+").");
    const csv = await response.text();
    this.assertActive();
    return csv;
  }
  createPerson(body: { name: string; email?: string; phone?: string }) {
    return this.request<Person>("crm", "/people", "POST", body);
  }
  createOrganization(body: { legalName: string; tradeName?: string; taxId?: string }) {
    return this.request<Organization>("crm", "/organizations", "POST", body);
  }
  /**
   * Fetch-based SSE uses the Bearer JWT header (native EventSource cannot).
   * Stream events contain no conversation data: only an invalidation signal.
   * Reconnect is the caller's responsibility; each 60s connection is reauthorized.
   */
  async watchInbox(signal: AbortSignal, onChange: () => void): Promise<void> {
    this.assertActive();
    const lifetime = AbortSignal.any([signal, this.lifetime.signal]);
    if (lifetime.aborted) return;
    const response = await fetch(
      "/v1/tenants/" + encodeURIComponent(this.tenantId) + "/inbox/events",
      {headers:{Authorization:"Bearer " + this.token,Accept:"text/event-stream",...this.scopeHeaders()},
        signal:lifetime,cache:"no-store"},
    );
    this.assertActive();
    if(lifetime.aborted)return;
    if(response.status===401)this.unauthorized();
    this.assertActive();
    if(!response.ok)throw new ApiError(response.status,
      response.status===403?"Sem permissão para notificações da Inbox.":"Realtime indisponível.");
    if(!response.body)throw new Error("SSE sem corpo de resposta");
    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let buffer="";
    try {
      while(!lifetime.aborted){
        const {value,done}=await reader.read();
        if(lifetime.aborted)break;
        if(done)break;
        buffer+=decoder.decode(value,{stream:true}).replaceAll("\r\n","\n");
        // Cap event buffer to avoid unbounded memory growth from malformed peers.
        if(buffer.length>65536)throw new Error("SSE inválido");
        let pos=buffer.indexOf("\n\n");
        while(pos>=0){
          const frame=buffer.slice(0,pos);
          buffer=buffer.slice(pos+2);
          if(lifetime.aborted)break;
          if(frame.split("\n").some(line=>line.trim()==="event: changed"))onChange();
          pos=buffer.indexOf("\n\n");
        }
      }
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  conversations(status = "", queue: QueueFilter = "all",scope="all",offset=0,search="") {
    return this.request<Conversation[]>("inbox", "/conversations?limit=100"
      + (status ? "&status=" + encodeURIComponent(status) : "")
      + "&queue=" + queue+"&scope="+encodeURIComponent(scope)+"&offset="+offset+"&q="+encodeURIComponent(search));
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
  setConversationFavorite(id:string,favorite:boolean){
    return this.request<Conversation>("inbox","/conversations/"+encodeURIComponent(id)+"/favorite","PATCH",{favorite});
  }
  requestConversationHistory(id:string){
    return this.request<{requested:boolean;note:string}>("inbox",
      "/conversations/"+encodeURIComponent(id)+"/history","POST");
  }
  markConversationRead(id:string){
    return this.request<Conversation>("inbox","/conversations/"+encodeURIComponent(id)+"/read","PATCH");
  }
  linkConversationContact(id:string,personId:string) {
    return this.request<Conversation>("inbox","/conversations/"+encodeURIComponent(id)+"/contact","PATCH",{personId});
  }
  setStatus(id: string, status: Conversation["status"]) {
    return this.request<Conversation>("inbox", "/conversations/" + encodeURIComponent(id) + "/status", "PATCH", { status });
  }
  setAssignment(id: string, assigneeId: string | null) {
    return this.request<Conversation>("inbox", "/conversations/" + encodeURIComponent(id) + "/assignment", "PATCH", { assigneeId });
  }
  transferWorkspace(id:string,workspaceId:string){
    return this.request<Conversation>("inbox",
      "/conversations/"+encodeURIComponent(id)+"/workspace","PATCH",{workspaceId});
  }
  setHandoff(id: string, mode: "human" | "bot") {
    return this.request<Conversation>("inbox", "/conversations/" + encodeURIComponent(id) + "/handoff", "PATCH", { mode });
  }
}
