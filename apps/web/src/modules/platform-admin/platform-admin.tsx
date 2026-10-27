"use client";

import { useEffect, useState, type FormEvent } from "react";
import { managerErrorMessage, managerRequest } from "./api";
import type { PlatformTenant, TenantDetail } from "./api";

interface TenantPage {
  items: PlatformTenant[];
  page: number;
  pageSize: number;
  total: number;
}

export function PlatformAdmin() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [selected, setSelected] = useState<TenantDetail | null>(null);
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const page = await managerRequest<TenantPage>(
        "tenants?page=1&pageSize=50",
      );
      setTenants(page.items);
      if (selected) {
        setSelected(
          await managerRequest<TenantDetail>(`/tenants/${selected.id}`),
        );
      }
    } catch (cause) {
      setError(
        managerErrorMessage(cause instanceof Error ? cause.message : ""),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (cause) {
      setError(
        managerErrorMessage(cause instanceof Error ? cause.message : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName) return;
    await run(async () => {
      const created = await managerRequest<PlatformTenant>("tenants", {
        method: "POST",
        body: JSON.stringify({ displayName }),
      });
      setName("");
      const detail = await managerRequest<TenantDetail>(
        `/tenants/${created.id}`,
      );
      setSelected(detail);
      setEditName(detail.displayName);
    }, "Tenant criado.");
  }

  async function openTenant(tenantId: string) {
    setError("");
    try {
      const detail = await managerRequest<TenantDetail>(`/tenants/${tenantId}`);
      setSelected(detail);
      setEditName(detail.displayName);
    } catch (cause) {
      setError(
        managerErrorMessage(cause instanceof Error ? cause.message : ""),
      );
    }
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Syndes · Control Plane</p>
          <h1>Platform Admin</h1>
        </div>
        <form action="/api/auth/keycloak-logout" method="post">
          <button className="quiet" type="submit">
            Sair
          </button>
        </form>
      </header>
      <p className="intro">
        Gerencie cadastro e provisionamento de tenants. Esta área exibe apenas
        metadados da plataforma.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="columns">
        <div className="panel">
          <h2>Novo tenant</h2>
          <form onSubmit={createTenant} className="stack">
            <label>
              Nome de exibição
              <input
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <button disabled={busy} type="submit">
              Criar tenant
            </button>
          </form>
          <h2 className="section-title">Tenants</h2>
          {loading ? (
            <p role="status">Carregando tenants…</p>
          ) : tenants.length === 0 ? (
            <p>Nenhum tenant cadastrado.</p>
          ) : (
            <ul className="tenant-list">
              {tenants.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    className="tenant-row"
                    onClick={() => void openTenant(tenant.id)}
                    type="button"
                    aria-current={
                      selected?.id === tenant.id ? "true" : undefined
                    }
                  >
                    <span>
                      <strong>{tenant.displayName}</strong>
                      <small>{tenant.id}</small>
                    </span>
                    <span className="state">{tenant.provisioningState}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel detail-panel">
          <h2>Detalhes e operações</h2>
          {!selected ? (
            <p>Selecione um tenant para consultar o estado.</p>
          ) : (
            <>
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">Tenant</p>
                  <h3>{selected.displayName}</h3>
                  <code>{selected.id}</code>
                </div>
                <span className="state">{selected.provisioningState}</span>
              </div>
              <dl className="facts">
                <div>
                  <dt>Etapa</dt>
                  <dd>{selected.provisioning.stage ?? "—"}</dd>
                </div>
                <div>
                  <dt>Tentativa</dt>
                  <dd>{selected.provisioning.attempt ?? "—"}</dd>
                </div>
                <div>
                  <dt>Falha</dt>
                  <dd>{selected.provisioning.failureCode ?? "—"}</dd>
                </div>
              </dl>
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () =>
                      managerRequest(`/tenants/${selected.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ displayName: editName.trim() }),
                      }),
                    "Metadados atualizados.",
                  );
                }}
              >
                <label>
                  Nome de exibição
                  <input
                    value={editName || selected.displayName}
                    maxLength={120}
                    onChange={(event) => setEditName(event.target.value)}
                    required
                  />
                </label>
                <button className="secondary" disabled={busy} type="submit">
                  Salvar nome
                </button>
              </form>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        managerRequest(`/tenants/${selected.id}/provisioning`, {
                          method: "POST",
                        }),
                      "Provisionamento atualizado.",
                    )
                  }
                  type="button"
                >
                  Iniciar / repetir provisionamento
                </button>
              </div>
              <form
                className="stack membership"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () =>
                      managerRequest(
                        `/tenants/${selected.id}/initial-admin-membership`,
                        {
                          method: "POST",
                          body: JSON.stringify({ issuer, subject }),
                        },
                      ),
                    "Admin inicial vinculado.",
                  );
                }}
              >
                <h3>Admin inicial existente</h3>
                <p>
                  Use o issuer e subject exatos da conta Keycloak. Nenhum
                  convite ou usuário é criado.
                </p>
                <label>
                  Issuer
                  <input
                    value={issuer}
                    onChange={(event) => setIssuer(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Subject
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    required
                  />
                </label>
                <button className="secondary" disabled={busy} type="submit">
                  Vincular tenant_admin
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
