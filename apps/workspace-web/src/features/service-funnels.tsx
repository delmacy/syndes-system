import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@syndes/front-shared/button";
import { Input } from "@syndes/front-shared/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, type ServiceFunnel, type TenantApi } from "@/lib/api";

export function ServiceFunnels({ api }: { api: TenantApi }) {
  const [funnels, setFunnels] = useState<ServiceFunnel[]>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [stages, setStages] = useState("");
  useEffect(() => {
    let active = true;
    api.serviceFunnels().then(result => {
      if (active) setFunnels(result);
    }).catch(reason => {
      if (active && reason instanceof ApiError && reason.status >= 500) {
        setError("Não foi possível consultar os funis neste workspace.");
      }
    });
    return () => { active = false; };
  }, [api]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setStatus("");
    const labels = stages.split("\n").map(label => label.trim()).filter(Boolean);
    if (!name.trim() || labels.length < 2 || labels.length > 8 ||
        labels.some(label => label.length > 120) || new Set(labels).size !== labels.length) {
      setError("Informe um nome e de duas a oito etapas distintas, com até 120 caracteres cada.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.publishServiceFunnel({
        code: "funil-" + crypto.randomUUID(),
        name: name.trim(),
        stages: labels.map((label, index) => ({ code: "etapa-" + (index + 1), label })),
      });
      setName("");
      setStages("");
      setStatus("Funil publicado.");
      try {
        setFunnels(await api.serviceFunnels());
      } catch {
        setStatus("Funil publicado. Reabra as configurações para atualizar a lista.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar o funil.");
    } finally {
      setSaving(false);
    }
  }

  if (!funnels) return error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null;
  return <section aria-labelledby="service-funnels-title" className="my-4 space-y-4 rounded-xl border bg-card p-4">
    <h2 id="service-funnels-title" className="font-semibold">Funis de atendimento</h2>
    {funnels.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum funil publicado neste workspace.</p> :
      <ul className="space-y-2 text-sm">{funnels.map(funnel => <li key={funnel.id}>
        <strong>{funnel.name}</strong><p className="text-muted-foreground">{funnel.stages.map(stage => stage.label).join(" → ")}</p>
      </li>)}</ul>}
    <form onSubmit={publish} className="space-y-3">
      <label className="block space-y-1 text-sm"><span>Nome do funil</span>
        <Input required maxLength={160} value={name} onChange={event => setName(event.target.value)} disabled={saving} />
      </label>
      <label className="block space-y-1 text-sm"><span>Etapas em ordem, uma por linha</span>
        <Textarea required rows={3} value={stages} onChange={event => setStages(event.target.value)} disabled={saving} />
      </label>
      <Button type="submit" disabled={saving}>{saving ? "Publicando…" : "Publicar funil"}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="text-sm">{status}</p>}
    </form>
  </section>;
}
