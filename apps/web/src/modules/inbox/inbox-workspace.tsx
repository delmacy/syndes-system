"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  inboxErrorMessage,
  inboxRequest,
  isInboxAttachmentAllowed,
  type InboxAttachment,
  type InboxAttachmentMutationResult,
  type InboxChannel,
  type InboxConversation,
  type InboxConversationStatus,
  type InboxMessage,
  type InboxQueueItem,
  type InboxQueuePage,
  type InboxMutationResult,
  type InboxNoteResult,
} from "./api";

type StatusFilter = "all" | InboxConversationStatus;
type ChannelFilter = "all" | InboxChannel;

/**
 * INBOX-05 frontend: conversation history is read through the authorized
 * `GET /inbox/conversations/:id/messages?after=&limit=` contract (the detail
 * route carries conversation/CRM metadata, the history route carries the
 * ordered, cursor-paginated message list). The backend default page is 50 and
 * the reviewed maximum is 200 entries.
 */
const INBOX_HISTORY_LIMIT = 200;

const STATUS_OPTIONS: Array<{ value: InboxConversationStatus; label: string }> = [
  { value: "open", label: "Aberto" },
  { value: "pending", label: "Pendente" },
  { value: "resolved", label: "Resolvido" },
];

const CHANNEL_OPTIONS: Array<{ value: InboxChannel; label: string }> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "unknown", label: "Sem canal" },
];

const STATUS_LABELS: Record<InboxConversationStatus, string> = {
  open: "Aberto",
  pending: "Pendente",
  resolved: "Resolvido",
};

interface InboxUserSummary {
  name: string | null;
  email: string | null;
  image: string | null;
}

interface SelectedConversation {
  id: string;
  subject: string;
  status: InboxConversationStatus;
  unreadCount: number;
  lastActivity?: string;
  messages: InboxMessage[];
}

export function InboxWorkspace({
  user,
}: {
  user?: InboxUserSummary | null;
}) {
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<InboxQueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [selected, setSelected] = useState<SelectedConversation | null>(
    null,
  );
  const [replyDraft, setReplyDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [attachments, setAttachments] = useState<InboxAttachment[]>([]);
  const [assigneeActorId, setAssigneeActorId] = useState<string | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const idempotencyKeyRef = useRef("");

  const selectedRef = useRef<SelectedConversation | null>(null);
  selectedRef.current = selected;

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (channelFilter !== "all") params.set("channel", channelFilter);
      const response = await inboxRequest<InboxQueuePage>(
        `/conversations?${params.toString()}`,
      );
      setTotal(response.total);
      setPage(response.page);
      setItems(Array.isArray(response.items) ? response.items : []);
    } catch (cause) {
      setError(
        inboxErrorMessage(
          cause instanceof Error ? cause.message : "inbox_error",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(conversationId: string) {
    setDetailLoading(true);
    try {
      const [conversation, messages] = await Promise.all([
        inboxRequest<InboxConversation>(`/conversations/${conversationId}`),
        inboxRequest<InboxMessage[]>(
          `/conversations/${conversationId}/messages?after=&limit=${INBOX_HISTORY_LIMIT}`,
        ),
      ]);
      const history = Array.isArray(messages) ? messages : [];
      const next: SelectedConversation = {
        id: conversation.id,
        subject: conversation.subject ?? "",
        status: conversation.status,
        unreadCount: conversation.unreadCount ?? 0,
        lastActivity: conversation.lastActivity ?? "",
        messages: history,
      };
      setSelected(next);
      setAssigneeActorId(conversation.assigneeActorId ?? null);
      const agentIds = new Set<string>();
      if (conversation.assigneeActorId) agentIds.add(conversation.assigneeActorId);
      for (const message of history) {
        const actorId = message.author?.actorId;
        if (actorId && message.author?.role === "agent") {
          agentIds.add(actorId);
        }
      }
      setAgents(Array.from(agentIds));
    } catch (cause) {
      setError(
        inboxErrorMessage(
          cause instanceof Error ? cause.message : "inbox_error",
        ),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, [page, statusFilter, channelFilter]);

  const reloadRef = useRef<() => void>(() => {});
  useEffect(() => {
    reloadRef.current = () => {
      void loadQueue();
      const current = selectedRef.current;
      if (current) void loadConversation(current.id);
    };
  });
  useEffect(() => {
    const refetch = () => reloadRef.current();
    window.addEventListener("online", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("online", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, []);

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const conversation = selectedRef.current;
    const content = replyDraft.trim();
    if (!conversation || !content) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const idempotencyKey =
      idempotencyKeyRef.current || `reply-${conversation.id}-${Date.now()}`;
    idempotencyKeyRef.current = idempotencyKey;
    try {
      const result: InboxMutationResult | undefined = await inboxRequest<
        InboxMutationResult
      >(`/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: content }),
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const succeeded = result ? result.success : true;
      if (succeeded) {
        setReplyDraft("");
        setAttachments([]);
        setNotice("Resposta enviada com sucesso.");
        await loadConversation(conversation.id);
        await loadQueue();
      } else {
        setNotice(result?.error || "Não foi possível enviar a resposta.");
      }
    } catch (cause) {
      setError(
        inboxErrorMessage(
          cause instanceof Error ? cause.message : "inbox_error",
        ),
      );
      // Keep the draft: failures and reconnects must not lose operator text.
    } finally {
      setBusy(false);
    }
  }

  async function handleNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const conversation = selectedRef.current;
    const content = noteDraft.trim();
    if (!conversation || !content) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result: InboxNoteResult | undefined = await inboxRequest<
        InboxNoteResult
      >(`/conversations/${conversation.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: content }),
      });
      const succeeded = result ? result.success : true;
      if (succeeded) {
        setNoteDraft("");
        setNotice("Nota privada salva.");
        await loadConversation(conversation.id);
        await loadQueue();
      } else {
        setNotice(result?.error || "Não foi possível salvar a nota.");
      }
    } catch (cause) {
      setError(
        inboxErrorMessage(
          cause instanceof Error ? cause.message : "inbox_error",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(actorId: string | null) {
    const conversation = selectedRef.current;
    if (!conversation) return;
    setBusy(true);
    setError(null);
    try {
      await inboxRequest(`/conversations/${conversation.id}/assignment`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeActorId: actorId }),
      });
      setAssigneeActorId(actorId);
      setNotice(
        actorId ? "Conversa atribuída ao atendente." : "Atribuição removida.",
      );
      await loadConversation(conversation.id);
      await loadQueue();
    } catch (cause) {
      setError(
        inboxErrorMessage(
          cause instanceof Error ? cause.message : "inbox_error",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(status: InboxConversationStatus) {
    const conversation = selectedRef.current;
    if (!conversation) return;
    setBusy(true);
    setError(null);
    try {
      await inboxRequest(`/conversations/${conversation.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice("Status atualizado.");
      await loadConversation(conversation.id);
      await loadQueue();
    } catch (cause) {
      setError(
        inboxErrorMessage(
          cause instanceof Error ? cause.message : "inbox_error",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const conversation = selectedRef.current;
    const file = event.target.files?.[0];
    // Allow re-selecting the same file after a successful/failed upload.
    event.target.value = "";
    if (!conversation || !file) return;
    if (!isInboxAttachmentAllowed(file)) {
      setError(
        `Anexo rejeitado: o arquivo "${file.name}" excede o limite de tamanho ou usa um tipo não permitido.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await inboxRequest<
        InboxAttachmentMutationResult | InboxAttachment
      >(`/conversations/${conversation.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const wrapped = "success" in result;
      const succeeded = wrapped ? result.success : true;
      if (succeeded) {
        const rawAttachment = result as InboxAttachment & {
          filename?: string;
          byteSize?: number;
          contentType?: string;
        };
        const attachment = wrapped
          ? result.attachment
          : {
              id: rawAttachment.id,
              name: rawAttachment.filename ?? rawAttachment.name,
              size: rawAttachment.byteSize ?? rawAttachment.size,
              type: rawAttachment.contentType ?? rawAttachment.type,
              conversationId: rawAttachment.conversationId,
            };
        if (attachment) {
          setAttachments((current) => [...current, attachment]);
        }
        setNotice("Anexo carregado com sucesso.");
        await loadConversation(conversation.id);
      } else {
        setNotice(
          wrapped && result.error
            ? result.error
            : "Não foi possível concluir o anexo.",
        );
      }
    } catch (cause) {
      setError(
        inboxErrorMessage(
          cause instanceof Error ? cause.message : "inbox_error",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  }

  function handleChannelFilterChange(value: string) {
    setChannelFilter(value as ChannelFilter);
    setPage(1);
  }

  const errorAlert = error ? (
    <p className="alert" role="alert">
      {error}
    </p>
  ) : null;

  const noticeText = notice ? (
    <p className="notice" role="status">
      {notice}
    </p>
  ) : null;

  return (
    <div className="inbox-screen">
      {errorAlert}
      {noticeText}
      {loading ? (
        <div className="panel" role="status">
          Carregando conversas…
        </div>
      ) : (
        <>
          <header className="inbox-header">
            <div className="inbox-header-left">
              <h1>Caixa de Entrada</h1>
              <p className="eyebrow">Syndes · Atendimento</p>
            </div>
            <div className="inbox-header-right">
              <span className="presenca">
                Atendido por {user?.name?.trim() || user?.email || "Atendente"}
              </span>
            </div>
          </header>
          <main className="inbox-main">
            <aside className="inbox-sidebar">
              <div className="inbox-filter-group">
                <h2>Filtro por Status</h2>
                <div className="filter-options">
                  <label
                    className={
                      statusFilter === "all"
                        ? "filter-option selected"
                        : "filter-option"
                    }
                  >
                    <input
                      type="radio"
                      name="inbox-status-filter"
                      value="all"
                      checked={statusFilter === "all"}
                      onChange={() => handleStatusFilterChange("all")}
                    />
                    Todos
                  </label>
                  {STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={
                        statusFilter === option.value
                          ? "filter-option selected"
                          : "filter-option"
                      }
                    >
                      <input
                        type="radio"
                        name="inbox-status-filter"
                        value={option.value}
                        checked={statusFilter === option.value}
                        onChange={() => handleStatusFilterChange(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="inbox-filter-group">
                <h2>Filtro por Canal</h2>
                <div className="filter-options">
                  <label
                    className={
                      channelFilter === "all"
                        ? "filter-option selected"
                        : "filter-option"
                    }
                  >
                    <input
                      type="radio"
                      name="inbox-channel-filter"
                      value="all"
                      checked={channelFilter === "all"}
                      onChange={() => handleChannelFilterChange("all")}
                    />
                    Todos
                  </label>
                  {CHANNEL_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={
                        channelFilter === option.value
                          ? "filter-option selected"
                          : "filter-option"
                      }
                    >
                      <input
                        type="radio"
                        name="inbox-channel-filter"
                        value={option.value}
                        checked={channelFilter === option.value}
                        onChange={() => handleChannelFilterChange(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </aside>
            <section className="inbox-conversation" aria-label="Conversa">
              {selected ? (
                <div className="conversation-panel">
                  <header className="conversation-header">
                    <h2 className="conversation-title">
                      {selected.subject || "Conversa sem assunto"}
                    </h2>
                    <span className="state">{STATUS_LABELS[selected.status]}</span>
                  </header>
                  <section className="message-timeline" aria-label="Timeline">
                    {detailLoading && selected.messages.length === 0 ? (
                      <p className="muted" role="status">
                        Carregando conversa…
                      </p>
                    ) : selected.messages.length === 0 ? (
                      <p className="muted">Sem mensagens registradas.</p>
                    ) : (
                      selected.messages.map((message) => {
                        const isPrivate = message.kind === "note";
                        return (
                          <article
                            key={message.id}
                            className={
                              isPrivate
                                ? "message note"
                                : `message ${
                                    message.kind === "outgoing"
                                      ? "outgoing"
                                      : message.kind === "inbound"
                                        ? "incoming"
                                        : "system"
                                  }`
                            }
                          >
                            <div className="message-author">
                              {message.author?.name || "Atendente"}
                            </div>
                            {isPrivate ? (
                              <div className="message-note-tag">Nota privada</div>
                            ) : null}
                            <div className="message-content">
                              {message.content}
                            </div>
                            <div className="message-meta">
                              {new Date(message.createdAt).toLocaleString("pt-BR")}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </section>
                  {selected.unreadCount > 0 ? (
                    <div className="message-system" role="status">
                      {selected.unreadCount} mensagem(ns) não lida(s)
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="empty-state">
                  <p className="muted">
                    Selecione uma conversa da fila para abrir o atendimento.
                  </p>
                </div>
              )}
              {selected ? (
                <section className="inbox-action-panel">
                  <div className="action-panel-inner">
                    <form
                      className="send-form"
                      aria-label="Enviar resposta"
                      onSubmit={(event) => void handleReply(event)}
                    >
                      <label htmlFor="inbox-reply-content">
                        Conteúdo da resposta
                      </label>
                      <textarea
                        id="inbox-reply-content"
                        name="content"
                        rows={3}
                        value={replyDraft}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        placeholder="Digite sua resposta..."
                        required
                      />
                      <label htmlFor="inbox-attachment">Anexo</label>
                      <input
                        id="inbox-attachment"
                        name="attachment"
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv"
                        onChange={(event) => void handleAttachmentChange(event)}
                      />
                      <button disabled={busy} type="submit">
                        {busy ? "Enviando…" : "Enviar resposta"}
                      </button>
                    </form>
                    <form
                      className="note-form"
                      aria-label="Salvar nota"
                      onSubmit={(event) => void handleNote(event)}
                    >
                      <label htmlFor="inbox-note-content">Nota privada</label>
                      <textarea
                        id="inbox-note-content"
                        name="noteContent"
                        rows={3}
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder="Registrar nota privada..."
                        required
                      />
                      <button disabled={busy} type="submit">
                        {busy ? "Salvando…" : "Salvar nota"}
                      </button>
                    </form>
                    {attachments.length ? (
                      <ul className="record-list">
                        {attachments.map((attachment) => (
                          <li key={attachment.id}>
                            <a
                              className="record-button"
                              href={`/api/backend/inbox/attachments/${attachment.id}`}
                            >
                              <span>
                                <strong>{attachment.name}</strong>
                                <small>{String(attachment.type)}</small>
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="conversation-controls">
                      <div className="status-selector">
                        <label htmlFor="inbox-status">Status</label>
                        <select
                          id="inbox-status"
                          value={selected.status}
                          onChange={(event) =>
                            void handleStatus(
                              event.target.value as InboxConversationStatus,
                            )
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="assign-selector">
                        <label htmlFor="inbox-assignee">Atribuir a</label>
                        <select
                          id="inbox-assignee"
                          value={assigneeActorId ?? ""}
                          onChange={(event) =>
                            void handleAssign(
                              event.target.value === ""
                                ? null
                                : event.target.value,
                            )
                          }
                        >
                          <option value="">Nenhum atendente</option>
                          {agents.map((agentId) => (
                            <option key={agentId} value={agentId}>
                              {agentId}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}
            </section>
            {!selected ? (
              <section className="inbox-queue">
                {items.length ? (
                  <>
                    <p className="muted" role="status">
                      {total} {total === 1 ? "conversa" : "conversas"} na fila
                    </p>
                    <ul className="record-list">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            className="record-button"
                            type="button"
                            onClick={() => void loadConversation(item.id)}
                          >
                            <span>
                              <strong>
                                {item.subject || "Conversa sem assunto"}
                              </strong>
                              <small>{item.preview}</small>
                            </span>
                            <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="muted" role="status">
                    Não há conversas na fila.
                  </p>
                )}
              </section>
            ) : null}
          </main>
          <footer
            className="inbox-footer"
            aria-label={navigator.onLine ? "Online" : "Offline"}
          >
            <p className="muted">
              Conexão: {navigator.onLine ? "Online" : "Offline"}
            </p>
            <form action="/api/auth/keycloak-logout" method="post">
              <button className="outline-button" type="submit">
                Sair
              </button>
            </form>
          </footer>
        </>
      )}
    </div>
  );
}
