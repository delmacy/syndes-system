"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { crmErrorMessage, crmRequest } from "./api";
import type { CrmRecord } from "./api";

type Section = "search" | "people" | "organizations" | "team" | "csv";
type Entity = "people" | "organizations";
interface PageResult {
  items: CrmRecord[];
  page: number;
  pageSize: number;
  total: number;
}
interface Member {
  actorId: string;
  role: string;
  customerScope: "cpf" | "pj" | "both";
  status: string;
}
interface CrmContext {
  role: "tenant_admin" | "tenant_member";
  customerScope: "cpf" | "pj" | "both";
}
interface TimelineItem {
  id: string;
  kind: string;
  occurredAt: string;
}
interface RelationshipLink {
  organizationId: string;
  organizationName: string;
  personId: string;
}

const sectionLabels: Record<Section, string> = {
  search: "Busca",
  people: "Pessoas",
  organizations: "Organizações",
  team: "Equipe",
  csv: "CSV",
};

function json(method: string, value?: unknown): RequestInit {
  return {
    method,
    ...(value === undefined
      ? {}
      : {
          body: JSON.stringify(value),
          headers: { "content-type": "application/json" },
        }),
  };
}

export function CoreCrmWorkspace() {
  const [section, setSection] = useState<Section>("search");
  const [context, setContext] = useState<CrmContext | null>(null);
  const [people, setPeople] = useState<CrmRecord[]>([]);
  const [organizations, setOrganizations] = useState<CrmRecord[]>([]);
  const [employees, setEmployees] = useState<CrmRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tags, setTags] = useState<CrmRecord[]>([]);
  const [selected, setSelected] = useState<{
    entity: Entity;
    record: CrmRecord;
  } | null>(null);
  const selectedRecordRef = useRef<{ entity: Entity; id: string } | null>(null);
  const [recordTags, setRecordTags] = useState<CrmRecord[]>([]);
  const [notes, setNotes] = useState<CrmRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [relationships, setRelationships] = useState<RelationshipLink[]>([]);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [results, setResults] = useState<CrmRecord[]>([]);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relatedOrganization, setRelatedOrganization] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [tagName, setTagName] = useState("");
  const [existingTagId, setExistingTagId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeActorId, setEmployeeActorId] = useState("");
  const [scopeActorId, setScopeActorId] = useState("");
  const [scope, setScope] = useState<Member["customerScope"]>("both");
  const [file, setFile] = useState<File | null>(null);
  const [csvEntity, setCsvEntity] = useState<Entity>("people");
  const [csvResult, setCsvResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<CrmRecord[]>([]);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchRequestId = useRef(0);
  const detailRequestId = useRef(0);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const current = await crmRequest<CrmContext>("/context");
      const [personPage, tagPage] = await Promise.all([
        crmRequest<PageResult>("/people?page=1&pageSize=50"),
        crmRequest<PageResult>("/tags?page=1&pageSize=100"),
      ]);
      setContext(current);
      setPeople(personPage.items);
      setTags(tagPage.items);
      if (current.customerScope !== "cpf") {
        const organizationPage = await crmRequest<PageResult>(
          "/organizations?page=1&pageSize=50",
        );
        setOrganizations(organizationPage.items);
      } else {
        setOrganizations([]);
      }
      if (current.role === "tenant_admin") {
        const [employeePage, membershipList] = await Promise.all([
          crmRequest<PageResult>("/employees?page=1&pageSize=100"),
          crmRequest<Member[]>("/memberships"),
        ]);
        setEmployees(employeePage.items);
        setMembers(membershipList);
      }
    } catch (cause) {
      setError(crmErrorMessage(cause instanceof Error ? cause.message : ""));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await loadWorkspace();
    } catch (cause) {
      setError(crmErrorMessage(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function openRecord(entity: Entity, record: CrmRecord) {
    const requestId = ++detailRequestId.current;
    selectedRecordRef.current = { entity, id: record.id };
    setError("");
    setSelected({ entity, record });
    setEditName(record.fullName ?? record.name ?? "");
    setEditEmail(record.email ?? "");
    setEditPhone(record.phone ?? "");
    setRecordTags([]);
    setNotes([]);
    setTimeline([]);
    setRelationships([]);
    setExistingTagId("");
    setArchiveConfirmation(false);
    const path =
      entity === "people"
        ? `/people/${record.id}`
        : `/organizations/${record.id}`;
    try {
      const [detail, eventPage, notePage, relationshipPage, tagPage] =
        await Promise.all([
          crmRequest<CrmRecord>(path),
          crmRequest<{ items: TimelineItem[] }>(
            entity === "people"
              ? `/people/${record.id}/timeline`
              : `/organizations/${record.id}/timeline`,
          ),
          crmRequest<PageResult>(
            `/notes?${entity === "people" ? "personId" : "organizationId"}=${record.id}&page=1&pageSize=50`,
          ),
          entity === "people" && context?.customerScope !== "cpf"
            ? crmRequest<{ items: RelationshipLink[] }>(
                `/people/${record.id}/relationships`,
              )
            : Promise.resolve({ items: [] as RelationshipLink[] }),
          crmRequest<PageResult>(
            entity === "people"
              ? `/tags/people/${record.id}?page=1&pageSize=100`
              : `/tags/organizations/${record.id}?page=1&pageSize=100`,
          ),
        ]);
      if (requestId !== detailRequestId.current) return;
      setSelected({ entity, record: detail });
      setEditName(detail.fullName ?? detail.name ?? "");
      setEditEmail(detail.email ?? "");
      setEditPhone(detail.phone ?? "");
      setTimeline(eventPage.items);
      setNotes(notePage.items);
      setRelationships(relationshipPage.items);
      setRecordTags(tagPage.items);
    } catch (cause) {
      if (requestId !== detailRequestId.current) return;
      setError(crmErrorMessage(cause instanceof Error ? cause.message : ""));
    }
  }

  async function refreshRecordActivity(
    entity: Entity,
    recordId: string,
  ): Promise<void> {
    const selectedAtStart = selectedRecordRef.current;
    if (
      !selectedAtStart ||
      selectedAtStart.entity !== entity ||
      selectedAtStart.id !== recordId
    )
      return;
    const requestId = ++detailRequestId.current;
    const target =
      entity === "people"
        ? `/people/${recordId}`
        : `/organizations/${recordId}`;
    const [eventPage, notePage, tagPage] = await Promise.all([
      crmRequest<{ items: TimelineItem[] }>(`${target}/timeline`),
      crmRequest<PageResult>(
        `/notes?${entity === "people" ? "personId" : "organizationId"}=${recordId}&page=1&pageSize=50`,
      ),
      crmRequest<PageResult>(
        entity === "people"
          ? `/tags/people/${recordId}?page=1&pageSize=100`
          : `/tags/organizations/${recordId}?page=1&pageSize=100`,
      ),
    ]);
    const selectedAfterLoad = selectedRecordRef.current;
    if (
      requestId !== detailRequestId.current ||
      !selectedAfterLoad ||
      selectedAfterLoad.entity !== entity ||
      selectedAfterLoad.id !== recordId
    )
      return;
    setTimeline(eventPage.items);
    setNotes(notePage.items);
    setRecordTags(tagPage.items);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = ++searchRequestId.current;
    setSearchSubmitted(true);
    setSearchBusy(true);
    setError("");
    setResults([]);
    try {
      const response = await crmRequest<{ items: CrmRecord[] }>(
        `/search?q=${encodeURIComponent(query.trim())}&page=1&pageSize=50`,
      );
      if (requestId !== searchRequestId.current) return;
      setResults(response.items);
    } catch (cause) {
      if (requestId !== searchRequestId.current) return;
      setError(crmErrorMessage(cause instanceof Error ? cause.message : ""));
    } finally {
      if (requestId === searchRequestId.current) setSearchBusy(false);
    }
  }

  async function createRecord(
    event: FormEvent<HTMLFormElement>,
    entity: Entity,
  ) {
    event.preventDefault();
    setDuplicateWarning([]);
    setError("");
    const unique = entity === "people" ? "cpf" : "cnpj";
    const input =
      entity === "people"
        ? {
            fullName: newName.trim(),
            ...(documentNumber ? { cpf: documentNumber } : {}),
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...(relatedOrganization
              ? { organizationId: relatedOrganization }
              : {}),
          }
        : {
            name: newName.trim(),
            ...(documentNumber ? { cnpj: documentNumber } : {}),
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
          };
    const duplicateParams = new URLSearchParams({
      entityType: entity === "people" ? "person" : "organization",
      ...(documentNumber ? { [unique]: documentNumber } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    });
    if (documentNumber || email || phone) {
      try {
        const check = await crmRequest<{ possibleDuplicates: CrmRecord[] }>(
          `/duplicates/possible?${duplicateParams.toString()}`,
        );
        if (check.possibleDuplicates.length) {
          setDuplicateWarning(check.possibleDuplicates);
          return;
        }
      } catch (cause) {
        setError(crmErrorMessage(cause instanceof Error ? cause.message : ""));
        return;
      }
    }
    await run(async () => {
      const created = await crmRequest<CrmRecord>(
        `/${entity}`,
        json("POST", input),
      );
      setNewName("");
      setDocumentNumber("");
      setEmail("");
      setPhone("");
      setRelatedOrganization("");
      await openRecord(entity, created);
    }, "Registro criado.");
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const target =
      selected.entity === "people"
        ? { personId: selected.record.id }
        : { organizationId: selected.record.id };
    await run(async () => {
      await crmRequest(
        "/notes",
        json("POST", { ...target, body: noteContent }),
      );
      setNoteContent("");
      await refreshRecordActivity(selected.entity, selected.record.id);
    }, "Nota adicionada.");
  }

  async function updateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const patch =
      selected.entity === "people"
        ? {
            fullName: editName.trim(),
            ...(editEmail ? { email: editEmail } : {}),
            ...(editPhone ? { phone: editPhone } : {}),
          }
        : {
            name: editName.trim(),
            ...(editEmail ? { email: editEmail } : {}),
            ...(editPhone ? { phone: editPhone } : {}),
          };
    await run(async () => {
      const detail = await crmRequest<CrmRecord>(
        `/${selected.entity}/${selected.record.id}`,
        json("PATCH", patch),
      );
      setSelected({ entity: selected.entity, record: detail });
      await refreshRecordActivity(selected.entity, selected.record.id);
    }, "Cadastro atualizado.");
  }

  async function addRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || selected.entity !== "people" || !relatedOrganization)
      return;
    await run(async () => {
      await crmRequest(
        "/relationships",
        json("POST", {
          personId: selected.record.id,
          organizationId: relatedOrganization,
        }),
      );
      const page = await crmRequest<{ items: RelationshipLink[] }>(
        `/people/${selected.record.id}/relationships`,
      );
      setRelationships(page.items);
      setRelatedOrganization("");
      await refreshRecordActivity(selected.entity, selected.record.id);
    }, "Vínculo PJ criado.");
  }

  async function removeRelationship(organizationId: string) {
    if (!selected || selected.entity !== "people") return;
    await run(async () => {
      await crmRequest(
        `/relationships/${selected.record.id}/${organizationId}`,
        { method: "DELETE" },
      );
      setRelationships((current) =>
        current.filter((item) => item.organizationId !== organizationId),
      );
      await refreshRecordActivity(selected.entity, selected.record.id);
    }, "Vínculo removido.");
  }

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await run(async () => {
      const tag = await crmRequest<CrmRecord>(
        "/tags",
        json("POST", { name: tagName.trim() }),
      );
      const target =
        selected.entity === "people"
          ? `people/${selected.record.id}`
          : `organizations/${selected.record.id}`;
      await crmRequest(`/tags/${tag.id}/${target}`, { method: "PUT" });
      setTagName("");
      await refreshRecordActivity(selected.entity, selected.record.id);
    }, "Tag vinculada.");
  }

  async function assignExistingTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !existingTagId) return;
    const target =
      selected.entity === "people"
        ? `people/${selected.record.id}`
        : `organizations/${selected.record.id}`;
    await run(async () => {
      await crmRequest(`/tags/${existingTagId}/${target}`, { method: "PUT" });
      setExistingTagId("");
      await refreshRecordActivity(selected.entity, selected.record.id);
    }, "Tag vinculada.");
  }

  async function detachTag(tagId: string) {
    if (!selected) return;
    const target =
      selected.entity === "people"
        ? `people/${selected.record.id}`
        : `organizations/${selected.record.id}`;
    await run(async () => {
      await crmRequest(`/tags/${tagId}/${target}`, { method: "DELETE" });
      await refreshRecordActivity(selected.entity, selected.record.id);
    }, "Tag removida.");
  }

  async function handleCsvImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("O arquivo excede o limite de 10 MiB.");
      return;
    }
    await run(async () => {
      const result = await crmRequest(
        `/csv/import?entityType=${csvEntity === "people" ? "person" : "organization"}`,
        {
          method: "POST",
          headers: { "content-type": "text/csv" },
          body: await file.text(),
        },
      );
      setCsvResult(result);
      setFile(null);
    }, "Importação validada.");
  }

  async function exportCsv() {
    try {
      const content = await crmRequest<string>(
        `/csv/export?entityType=${csvEntity === "people" ? "person" : "organization"}`,
      );
      const url = URL.createObjectURL(
        new Blob([content], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `crm-${csvEntity}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(crmErrorMessage(cause instanceof Error ? cause.message : ""));
    }
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await crmRequest(
        "/employees",
        json("POST", {
          displayName: employeeName,
          ...(employeeActorId ? { controlPlaneActorId: employeeActorId } : {}),
        }),
      );
      setEmployeeName("");
      setEmployeeActorId("");
    }, "Perfil de atendente salvo.");
  }

  async function updateScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      () =>
        crmRequest(
          `/memberships/${scopeActorId}/scope`,
          json("PUT", { customerScope: scope }),
        ),
      "Escopo do atendente atualizado.",
    );
  }

  function fileChanged(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setCsvResult(null);
  }

  function closeRecord() {
    detailRequestId.current += 1;
    selectedRecordRef.current = null;
    setSelected(null);
    setRecordTags([]);
    setArchiveConfirmation(false);
  }

  return (
    <main className="crm-shell">
      <aside className="crm-sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            <strong>Syndes</strong>
            <small>Customer workspace</small>
          </div>
        </div>
        <nav aria-label="Módulos CRM">
          {(Object.keys(sectionLabels) as Section[])
            .filter(
              (item) =>
                (item !== "team" || context?.role === "tenant_admin") &&
                (item !== "organizations" || context?.customerScope !== "cpf"),
            )
            .map((item) => (
              <button
                key={item}
                className={section === item ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setSection(item);
                  closeRecord();
                }}
                type="button"
              >
                <span className="nav-dot" />
                {sectionLabels[item]}
              </button>
            ))}
        </nav>
        <div className="sidebar-foot">
          <span className="presence" />
          Sessão segura · {context?.customerScope?.toUpperCase() ?? "…"}
        </div>
      </aside>
      <section className="crm-main">
        <header className="crm-header">
          <div>
            <p className="eyebrow">Relacionamento com clientes</p>
            <h1>{sectionLabels[section]}</h1>
          </div>
          <form action="/api/auth/keycloak-logout" method="post">
            <button className="outline-button" type="submit">
              Sair
            </button>
          </form>
        </header>
        {error && (
          <p className="crm-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="crm-notice" role="status">
            {notice}
          </p>
        )}
        {loading ? (
          <div className="crm-card" role="status">
            Carregando seu CRM…
          </div>
        ) : (
          <>
            {section === "search" && (
              <section className="crm-card">
                <form className="search-form" onSubmit={search}>
                  <label htmlFor="crm-search">
                    Buscar pessoas, empresas, contato ou tags
                  </label>
                  <div>
                    <input
                      id="crm-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Nome, telefone, e-mail, CNPJ ou tag"
                      required
                    />
                    <button disabled={searchBusy} type="submit">
                      {searchBusy ? "Buscando…" : "Buscar"}
                    </button>
                  </div>
                </form>
                {results.length ? (
                  <RecordList
                    records={results}
                    onOpen={(record) =>
                      void openRecord(
                        record.entityType === "organization"
                          ? "organizations"
                          : "people",
                        record,
                      )
                    }
                  />
                ) : searchSubmitted && !searchBusy && !error ? (
                  <p className="muted">
                    Nenhum cadastro encontrado para esta busca.
                  </p>
                ) : !searchSubmitted ? (
                  <p className="muted">
                    Pesquise no seu escopo de atendimento.
                  </p>
                ) : null}
                {searchBusy && (
                  <p className="muted" role="status">
                    Buscando cadastros…
                  </p>
                )}
              </section>
            )}
            {(section === "people" || section === "organizations") && (
              <div className="crm-grid">
                <section className="crm-card">
                  <div className="card-heading">
                    <div>
                      <p className="eyebrow">Cadastros</p>
                      <h2>{sectionLabels[section]}</h2>
                    </div>
                    <span className="count-pill">
                      {(section === "people" ? people : organizations).length}
                    </span>
                  </div>
                  <RecordList
                    records={section === "people" ? people : organizations}
                    onOpen={(record) => void openRecord(section, record)}
                    empty="Nenhum registro neste escopo."
                  />
                </section>
                <section className="crm-card">
                  <h2>
                    Novo {section === "people" ? "contato" : "cliente PJ"}
                  </h2>
                  <form
                    className="crm-form"
                    onSubmit={(event) => void createRecord(event, section)}
                  >
                    <label>
                      {section === "people" ? "Nome completo" : "Razão / nome"}
                      <input
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        required
                        maxLength={200}
                      />
                    </label>
                    <label>
                      {section === "people" ? "CPF" : "CNPJ"}
                      <input
                        value={documentNumber}
                        onChange={(event) =>
                          setDocumentNumber(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      E-mail
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </label>
                    <label>
                      Telefone
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </label>
                    {section === "people" &&
                      context?.customerScope !== "cpf" && (
                        <label>
                          Organização PJ (opcional)
                          <select
                            value={relatedOrganization}
                            onChange={(event) =>
                              setRelatedOrganization(event.target.value)
                            }
                          >
                            <option value="">Pessoa física sem vínculo</option>
                            {organizations.map((org) => (
                              <option key={org.id} value={org.id}>
                                {org.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    <button disabled={busy} type="submit">
                      Criar cadastro
                    </button>
                    {duplicateWarning.length > 0 && (
                      <div className="duplicate-warning" role="alert">
                        <strong>Possíveis duplicatas</strong>
                        <p>
                          Revise os registros antes de continuar. Nenhum dado
                          foi mesclado.
                        </p>
                        <RecordList
                          records={duplicateWarning}
                          onOpen={(record) => void openRecord(section, record)}
                        />
                      </div>
                    )}
                  </form>
                </section>
              </div>
            )}
            {section === "team" && context?.role === "tenant_admin" && (
              <div className="crm-grid">
                <section className="crm-card">
                  <h2>Atendentes</h2>
                  <ul className="record-list">
                    {employees.map((employee) => (
                      <li key={employee.id}>
                        <span>
                          <strong>{employee.displayName}</strong>
                          <small>
                            {employee.controlPlaneActorId ||
                              "Sem conta vinculada"}
                          </small>
                          <small>{employee.active ? "Ativo" : "Inativo"}</small>
                        </span>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                crmRequest(
                                  `/employees/${employee.id}`,
                                  json("PATCH", { active: !employee.active }),
                                ),
                              "Perfil de atendente atualizado.",
                            )
                          }
                          type="button"
                        >
                          {employee.active ? "Desativar" : "Ativar"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form
                    className="crm-form"
                    onSubmit={(event) => void saveEmployee(event)}
                  >
                    <label>
                      Nome de exibição
                      <input
                        value={employeeName}
                        onChange={(event) =>
                          setEmployeeName(event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      Actor ID (opcional)
                      <input
                        value={employeeActorId}
                        onChange={(event) =>
                          setEmployeeActorId(event.target.value)
                        }
                      />
                    </label>
                    <button disabled={busy}>Adicionar atendente</button>
                  </form>
                </section>
                <section className="crm-card">
                  <h2>Escopo dos membros</h2>
                  <p className="muted">
                    O tenant_admin controla quais clientes cada conta pode
                    atender.
                  </p>
                  <ul className="record-list">
                    {members
                      .filter((member) => member.status === "active")
                      .map((member) => (
                        <li key={member.actorId}>
                          <span>
                            <strong>
                              {member.customerScope.toUpperCase()}
                            </strong>
                            <small>{member.actorId}</small>
                          </span>
                          <button
                            className="text-button"
                            onClick={() => {
                              setScopeActorId(member.actorId);
                              setScope(member.customerScope);
                            }}
                            type="button"
                          >
                            Editar
                          </button>
                        </li>
                      ))}
                  </ul>
                  <form
                    className="crm-form"
                    onSubmit={(event) => void updateScope(event)}
                  >
                    <label>
                      Atendente
                      <select
                        value={scopeActorId}
                        onChange={(event) =>
                          setScopeActorId(event.target.value)
                        }
                        required
                      >
                        <option value="">Selecione</option>
                        {members
                          .filter((member) => member.status === "active")
                          .map((member) => (
                            <option key={member.actorId} value={member.actorId}>
                              {member.actorId}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Escopo
                      <select
                        value={scope}
                        onChange={(event) =>
                          setScope(
                            event.target.value as Member["customerScope"],
                          )
                        }
                      >
                        <option value="cpf">
                          CPF · pessoas sem vínculo PJ
                        </option>
                        <option value="pj">
                          PJ · empresas e contatos vinculados
                        </option>
                        <option value="both">Ambos</option>
                      </select>
                    </label>
                    <button disabled={busy}>Salvar escopo</button>
                  </form>
                </section>
              </div>
            )}
            {section === "csv" && (
              <div className="crm-grid">
                <section className="crm-card">
                  <p className="eyebrow">Importar em lote</p>
                  <h2>CSV seguro</h2>
                  <p className="muted">
                    UTF-8, cabeçalho obrigatório, até 10 MiB e 10.000 linhas. A
                    importação é integral: qualquer erro evita gravação.
                  </p>
                  <form
                    className="crm-form"
                    onSubmit={(event) => void handleCsvImport(event)}
                  >
                    <label>
                      Tipo de cadastro
                      <select
                        value={csvEntity}
                        onChange={(event) =>
                          setCsvEntity(event.target.value as Entity)
                        }
                      >
                        <option value="people">Pessoas</option>
                        <option value="organizations">Organizações</option>
                      </select>
                    </label>
                    <label>
                      Arquivo CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={fileChanged}
                      />
                    </label>
                    <button disabled={!file || busy}>Validar e importar</button>
                  </form>
                  {csvResult !== null && (
                    <pre className="result-json">
                      {JSON.stringify(csvResult, null, 2)}
                    </pre>
                  )}
                </section>
                <section className="crm-card">
                  <p className="eyebrow">Exportar cadastro</p>
                  <h2>Dados no escopo atual</h2>
                  <p className="muted">
                    A exportação é restrita a tenant_admin e os dados permanecem
                    no tenant atual.
                  </p>
                  <label>
                    Tipo de cadastro
                    <select
                      value={csvEntity}
                      onChange={(event) =>
                        setCsvEntity(event.target.value as Entity)
                      }
                    >
                      <option value="people">Pessoas</option>
                      <option value="organizations">Organizações</option>
                    </select>
                  </label>
                  <button
                    className="secondary-button"
                    disabled={context?.role !== "tenant_admin"}
                    onClick={() => void exportCsv()}
                    type="button"
                  >
                    Baixar CSV
                  </button>
                </section>
              </div>
            )}
            {selected && (
              <section className="crm-card record-detail">
                <button
                  className="text-button close-detail"
                  onClick={closeRecord}
                  type="button"
                >
                  Fechar detalhes ×
                </button>
                <p className="eyebrow">Registro selecionado</p>
                <h2>{selected.record.fullName ?? selected.record.name}</h2>
                <div className="detail-facts">
                  <span>
                    {selected.record.cpf ??
                      selected.record.cnpj ??
                      "Documento não informado"}
                  </span>
                  <span>{selected.record.email ?? "Sem e-mail"}</span>
                  <span>{selected.record.phone ?? "Sem telefone"}</span>
                </div>
                <form
                  className="crm-form detail-edit"
                  onSubmit={(event) => void updateRecord(event)}
                >
                  <h3>Editar cadastro</h3>
                  <label>
                    {selected.entity === "people"
                      ? "Nome completo"
                      : "Razão / nome"}
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(event) => setEditEmail(event.target.value)}
                    />
                  </label>
                  <label>
                    Telefone
                    <input
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button" disabled={busy}>
                    Salvar alterações
                  </button>
                </form>
                {context?.role === "tenant_admin" && (
                  <div className="archive-action">
                    <button
                      className="danger-button"
                      disabled={busy}
                      onClick={() => setArchiveConfirmation(true)}
                      type="button"
                    >
                      Arquivar
                    </button>
                    {archiveConfirmation && (
                      <div
                        className="archive-confirmation"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="archive-confirmation-title"
                      >
                        <strong id="archive-confirmation-title">
                          Arquivar este cadastro?
                        </strong>
                        <p>
                          Ele deixará de aparecer nas listas ativas, mas seu
                          histórico será preservado.
                        </p>
                        <button
                          disabled={busy}
                          onClick={() => setArchiveConfirmation(false)}
                          type="button"
                        >
                          Cancelar
                        </button>
                        <button
                          className="danger-button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await crmRequest(
                                `/${selected.entity}/${selected.record.id}`,
                                { method: "DELETE" },
                              );
                              closeRecord();
                            }, "Registro arquivado.")
                          }
                          type="button"
                        >
                          Confirmar arquivamento
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {selected.entity === "people" && (
                  <ChannelIdentityPanel personId={selected.record.id} />
                )}
                {selected.entity === "people" &&
                  context?.customerScope !== "cpf" && (
                    <section className="relationship-panel">
                      <h3>Vínculos com organizações</h3>
                      <ul className="record-list">
                        {relationships.map((link) => (
                          <li key={link.organizationId}>
                            <span>{link.organizationName}</span>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void removeRelationship(link.organizationId)
                              }
                              type="button"
                            >
                              Remover vínculo
                            </button>
                          </li>
                        ))}
                      </ul>
                      <form
                        className="inline-form"
                        onSubmit={(event) => void addRelationship(event)}
                      >
                        <label>
                          Adicionar organização
                          <select
                            aria-label="Adicionar organização"
                            value={relatedOrganization}
                            onChange={(event) =>
                              setRelatedOrganization(event.target.value)
                            }
                            required
                          >
                            <option value="">Selecione</option>
                            {organizations
                              .filter(
                                (org) =>
                                  !relationships.some(
                                    (link) => link.organizationId === org.id,
                                  ),
                              )
                              .map((org) => (
                                <option key={org.id} value={org.id}>
                                  {org.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button disabled={busy || !relatedOrganization}>
                          Criar vínculo
                        </button>
                      </form>
                    </section>
                  )}
                <div className="crm-grid detail-grid">
                  <section>
                    <h3>Tags</h3>
                    {recordTags.length ? (
                      <ul className="tag-list">
                        {recordTags.map((tag) => (
                          <li key={tag.id}>
                            {String(tag.name)}
                            <button
                              aria-label={`Remover tag ${String(tag.name)}`}
                              disabled={busy}
                              onClick={() => void detachTag(tag.id)}
                              type="button"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Nenhuma tag vinculada.</p>
                    )}
                    <form
                      className="inline-form"
                      onSubmit={(event) => void assignExistingTag(event)}
                    >
                      <label>
                        Vincular tag existente
                        <select
                          aria-label="Tag existente"
                          value={existingTagId}
                          onChange={(event) =>
                            setExistingTagId(event.target.value)
                          }
                        >
                          <option value="">Selecione</option>
                          {tags
                            .filter(
                              (tag) =>
                                !recordTags.some(
                                  (assigned) => assigned.id === tag.id,
                                ),
                            )
                            .map((tag) => (
                              <option key={tag.id} value={tag.id}>
                                {String(tag.name)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button disabled={busy || !existingTagId} type="submit">
                        Vincular tag
                      </button>
                    </form>
                    <form
                      className="inline-form"
                      onSubmit={(event) => void createTag(event)}
                    >
                      <label>
                        Criar nova tag
                        <input
                          aria-label="Nova tag"
                          value={tagName}
                          onChange={(event) => setTagName(event.target.value)}
                          placeholder="Nome da tag"
                          maxLength={100}
                          required
                        />
                      </label>
                      <button disabled={busy || !tagName.trim()} type="submit">
                        Criar e vincular
                      </button>
                    </form>
                  </section>
                  <section>
                    <h3>Notas</h3>
                    <form
                      className="inline-form"
                      onSubmit={(event) => void addNote(event)}
                    >
                      <input
                        aria-label="Nova nota"
                        value={noteContent}
                        onChange={(event) => setNoteContent(event.target.value)}
                        placeholder="Registrar interação"
                        required
                        maxLength={5000}
                      />
                      <button disabled={busy}>Salvar</button>
                    </form>
                    <ul className="record-list">
                      {notes.map((note) => (
                        <li key={note.id}>{String(note.body)}</li>
                      ))}
                    </ul>
                  </section>
                  <section className="timeline-section">
                    <h3>Timeline</h3>
                    <ol className="timeline-list">
                      {timeline.map((item) => (
                        <li key={item.id}>
                          <span>{item.kind}</span>
                          <time>
                            {new Date(item.occurredAt).toLocaleString("pt-BR")}
                          </time>
                        </li>
                      ))}
                    </ol>
                    {!timeline.length && (
                      <p className="muted">Nenhuma atividade registrada.</p>
                    )}
                  </section>
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function RecordList({
  records,
  onOpen,
  empty = "Nenhum registro encontrado.",
}: {
  records: CrmRecord[];
  onOpen: (record: CrmRecord) => void;
  empty?: string;
}) {
  if (!records.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="record-list">
      {records.map((record) => (
        <li key={record.id}>
          <button
            className="record-button"
            onClick={() => onOpen(record)}
            type="button"
          >
            <span>
              <strong>
                {record.fullName ??
                  record.name ??
                  String(record.displayName ?? "Registro")}
              </strong>
              <small>
                {record.email ??
                  record.phone ??
                  record.cpf ??
                  record.cnpj ??
                  record.id}
              </small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChannelIdentityPanel({ personId }: { personId: string }) {
  const [identities, setIdentities] = useState<CrmRecord[]>([]);
  const [externalId, setExternalId] = useState("");
  const [pushName, setPushName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void crmRequest<{ items: CrmRecord[] }>(
      `/people/${personId}/channel-identities`,
    )
      .then((result) => setIdentities(result.items))
      .catch(() =>
        setError("Não foi possível carregar a identidade do canal."),
      );
  }, [personId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const identity = await crmRequest<CrmRecord>(
        `/people/${personId}/channel-identities`,
        json("PUT", {
          channel: "whatsapp",
          externalId,
          ...(pushName ? { pushName } : {}),
        }),
      );
      setIdentities((current) => [
        ...current.filter((item) => item.id !== identity.id),
        identity,
      ]);
      setExternalId("");
      setPushName("");
    } catch {
      setError(
        "Não foi possível vincular a identidade. O nome confirmado do CRM permanece preservado.",
      );
    }
  }
  return (
    <section className="channel-panel">
      <h3>Identidades externas</h3>
      <ul className="record-list">
        {identities.map((item) => (
          <li key={item.id}>
            WhatsApp · {String(item.externalId)}
            {item.pushName ? ` · ${String(item.pushName)}` : ""}
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={(event) => void save(event)}>
        <input
          aria-label="WhatsApp external id"
          value={externalId}
          onChange={(event) => setExternalId(event.target.value)}
          placeholder="Número externo"
          required
        />
        <input
          aria-label="Nome externo"
          value={pushName}
          onChange={(event) => setPushName(event.target.value)}
          placeholder="Push name (opcional)"
        />
        <button type="submit">Vincular</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
