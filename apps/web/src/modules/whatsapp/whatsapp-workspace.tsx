"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  whatsappErrorMessage,
  whatsappRequest,
  type WhatsAppConnection,
  type WhatsAppPairing,
} from "./api";

export function WhatsAppWorkspace({
  user,
}: {
  user?: { name?: string | null; email?: string | null };
}) {
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [pairing, setPairing] = useState<WhatsAppPairing | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setConnection(await whatsappRequest<WhatsAppConnection>("/connection"));
      setError(null);
    } catch (cause) {
      setConnection(null);
      setPairing(null);
      setQrDataUrl(null);
      setQrExpired(false);
      setError(
        whatsappErrorMessage(
          cause instanceof Error ? cause.message : "unknown",
        ),
      );
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);

  useEffect(() => {
    if (!pairing || !qrDataUrl) return;

    const expirePairing = () => {
      setPairing(null);
      setQrDataUrl(null);
      setQrExpired(true);
      setNotice(null);
    };
    const expiresAt = Date.parse(pairing.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      expirePairing();
      return;
    }
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      void renewPairing();
      return;
    }

    const timer = setTimeout(async () => {
      await renewPairing();
    }, delay);
    return () => clearTimeout(timer);
  }, [pairing, qrDataUrl]);

  async function generatePairing(): Promise<boolean> {
    setPairing(null);
    setQrDataUrl(null);
    setQrExpired(false);
    const next = await whatsappRequest<WhatsAppPairing>("/pairing", {
      method: "POST",
      body: "{}",
    });
    setPairing(next);
    const { default: QRCode } = await import("qrcode");
    setQrDataUrl(
      await QRCode.toDataURL(next.pairingCode, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: "M",
      }),
    );
    setNotice("Escaneie o QR no WhatsApp e depois confirme a conexão.");
    return true;
  }

  async function renewPairing(): Promise<boolean> {
    setPairing(null);
    setQrDataUrl(null);
    setQrExpired(true);
    setNotice(null);
    try {
      setBusy("pairing");
      const next = await whatsappRequest<WhatsAppPairing>("/pairing", {
        method: "POST",
        body: "{}",
      });
      setPairing(next);
      const { default: QRCode } = await import("qrcode");
      setQrDataUrl(
        await QRCode.toDataURL(next.pairingCode, {
          width: 280,
          margin: 1,
          errorCorrectionLevel: "M",
        }),
      );
      setQrExpired(false);
      setNotice("Novo QR gerado. Escaneie o QR no WhatsApp.");
      return true;
    } catch (cause) {
      return handlePairingError(cause, true);
    } finally {
      setBusy(null);
    }
  }

  function handlePairingError(cause: unknown, markExpired = false): boolean {
    const code = cause instanceof Error ? cause.message : "unknown";
    const isSessionExpired = code === "http_401" || code === "unauthorized";
    if (isSessionExpired) {
      setConnection(null);
      setPairing(null);
      setQrDataUrl(null);
      setQrExpired(false);
    } else if (markExpired) {
      setPairing(null);
      setQrDataUrl(null);
      setQrExpired(true);
    }
    setError(whatsappErrorMessage(isSessionExpired ? "http_401" : code));
    return false;
  }

  async function action(
    name: "pairing" | "connect" | "reconnect" | "disconnect",
  ) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      if (name === "pairing") {
        await generatePairing();
      } else {
        await whatsappRequest(`/${name}`, { method: "POST", body: "{}" });
        if (name === "disconnect") {
          setPairing(null);
          setQrDataUrl(null);
          setNotice("Conexão interrompida sem apagar a sessão.");
        } else {
          setNotice(
            name === "connect"
              ? "WhatsApp conectado."
              : "Reconexão solicitada.",
          );
        }
        await refresh();
      }
    } catch (cause) {
      handlePairingError(cause);
    } finally {
      setBusy(null);
    }
  }

  const status = connection?.status ?? "disconnected";
  return (
    <main className="whatsapp-screen">
      <header className="whatsapp-header">
        <div>
          <p className="eyebrow">Syndes · Canal</p>
          <h1>WhatsApp</h1>
          <p className="muted">
            Um número por tenant, conectado ao Inbox e protegido pelo limite de
            40 envios por minuto.
          </p>
        </div>
      </header>

      {error ? (
        <p className="crm-alert" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="crm-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="whatsapp-grid" aria-label="Configuração do WhatsApp">
        <article className="whatsapp-card status-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Estado da conexão</p>
              <h2>
                {connection
                  ? statusLabel(status)
                  : error
                    ? "Configuração indisponível"
                    : "Verificando autorização"}
              </h2>
            </div>
            {connection ? (
              <span className={`connection-badge ${status}`}>
                {statusLabel(status)}
              </span>
            ) : null}
          </div>
          {connection ? (
            <dl className="connection-facts">
            <div>
              <dt>Conta</dt>
              <dd>{connection?.phoneExternalId ?? "Ainda não vinculada"}</dd>
            </div>
            <div>
              <dt>Última atualização</dt>
              <dd>{formatDate(connection?.updatedAt)}</dd>
            </div>
            <div>
              <dt>Operador</dt>
              <dd>{user?.name ?? user?.email ?? "Sessão autenticada"}</dd>
            </div>
            <div>
              <dt>Sessão autorizada</dt>
              <dd>{connection?.authorized ? "Sim" : "Não"}</dd>
            </div>
            <div>
              <dt>Serviço</dt>
              <dd>
                {connection?.serviceEnabled === false
                  ? "Suspenso por inadimplência"
                  : "Habilitado"}
              </dd>
            </div>
            </dl>
          ) : !error ? (
            <p className="muted" role="status">
              Aguardando a verificação de acesso do servidor.
            </p>
          ) : null}
          <div className="whatsapp-actions">
            {connection ? (
              <>
                {status !== "connected" && status !== "suspended" ? (
                  <button
                    disabled={busy !== null}
                    onClick={() => action("pairing")}
                  >
                    Gerar QR de pareamento
                  </button>
                ) : null}
                {status === "suspended" ? (
                  <p className="muted">
                    A sessão foi preservada e será reativada automaticamente
                    após a confirmação do pagamento.
                  </p>
                ) : null}
                {(status === "pairing" || pairing) && !qrExpired ? (
                  <button
                    className="secondary"
                    disabled={busy !== null}
                    onClick={() => action("connect")}
                  >
                    Confirmar conexão
                  </button>
                ) : null}
                {status === "error" || status === "disconnected" ? (
                  <button
                    className="secondary"
                    disabled={busy !== null}
                    onClick={() => action("reconnect")}
                  >
                    Reconectar
                  </button>
                ) : null}
                {status === "connected" ? (
                  <button
                    className="danger-button"
                    disabled={busy !== null}
                    onClick={() => action("disconnect")}
                  >
                    Desconectar
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </article>

        {connection ? (
          <article className="whatsapp-card pairing-card">
          <p className="eyebrow">Pareamento seguro</p>
          <h2>Vincule o aparelho</h2>
          {qrDataUrl && pairing ? (
            <div className="qr-panel">
              <Image
                unoptimized
                src={qrDataUrl}
                alt="QR code temporário para parear o WhatsApp"
                width={280}
                height={280}
              />
              <p>
                Expira em{" "}
                {new Date(pairing.expiresAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </p>
            </div>
          ) : qrExpired ? (
            <p className="crm-notice" role="status">
              QR expirado. Gere um novo QR para continuar o pareamento.
            </p>
          ) : (
            <div className="pairing-placeholder">
              <span aria-hidden="true">▦</span>
              <p>
                O QR temporário aparece aqui. Ele nunca é gravado em logs ou no
                navegador após desconectar.
              </p>
            </div>
          )}
          </article>
        ) : null}

        <article className="whatsapp-card operations-card">
          <p className="eyebrow">Proteções operacionais</p>
          <h2>Entrega controlada</h2>
          <ul>
            <li>Inbound autenticado e idempotente no tenant correto.</li>
            <li>Outbound somente por resposta autorizada no Inbox.</li>
            <li>
              Fila independente e limite de 40 mensagens/minuto por conta.
            </li>
            <li>Desconectar ou suspender não apaga a sessão.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

function statusLabel(status: WhatsAppConnection["status"]): string {
  return {
    disconnected: "Desconectado",
    pairing: "Aguardando pareamento",
    connected: "Conectado",
    suspended: "Suspenso",
    error: "Atenção necessária",
  }[status];
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "Sem atualização";
}
