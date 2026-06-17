import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentScope } from "@/lib/scope";
import type { DbExame } from "@/lib/db-types";
import {
  FormDialog,
  Field,
  Grid,
  Input,
  DialogFooter,
} from "@/routes/_authenticated/agencia/clinicas";

export const Route = createFileRoute("/_authenticated/recepcao/exames")({
  head: () => ({ meta: [{ title: "Exames — Recepção" }] }),
  component: ExamesPage,
});

type ExameStatus = "aguardando" | "link enviado" | "precisa de humano" | "finalizado";

const STATUS_LABEL: Record<ExameStatus, string> = {
  aguardando: "Aguardando",
  "link enviado": "Link enviado",
  "precisa de humano": "Precisa de humano",
  finalizado: "Finalizado",
};

type FormState = {
  tutor: string;
  cpf: string;
  pet: string;
  tipo: string;
  link_lab: string;
  login_informado: boolean;
  senha_informada: boolean;
};

const EMPTY: FormState = {
  tutor: "",
  cpf: "",
  pet: "",
  tipo: "",
  link_lab: "",
  login_informado: false,
  senha_informada: false,
};

function ExamesPage() {
  const { clinicaId, unidadeId } = useCurrentScope();
  const [items, setItems] = useState<DbExame[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  async function load() {
    let q = supabase
      .from("exames")
      .select("*")
      .order("created_at", { ascending: false });

    if (clinicaId) q = q.eq("clinica_id", clinicaId);
    if (unidadeId) q = q.eq("unidade_id", unidadeId);

    const { data } = await q;
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
  }, [clinicaId, unidadeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tutor || !form.pet) return toast.error("Informe tutor e pet");
    if (!clinicaId) return toast.error("Clínica não identificada");
    const { error } = await supabase.from("exames").insert({
      ...form,
      clinica_id: clinicaId,
      unidade_id: unidadeId,
      status: "aguardando",
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação registrada");
    setForm(EMPTY);
    setOpen(false);
    load();
  }

  async function updateStatus(id: string, status: ExameStatus) {
    const { error } = await supabase.from("exames").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("exames").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Resultados de exame"
        description="Acompanhe solicitações de resultado de exame dos tutores."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand/90"
          >
            <Plus className="size-4" /> Nova solicitação
          </button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="size-5" />}
          title="Nenhuma solicitação de exame"
          description="As solicitações aparecerão aqui quando tutores pedirem resultados."
        />
      ) : (
        <div className="bg-card ring-1 ring-black/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Tutor / Pet</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Login</th>
                <th className="px-4 py-3 font-medium">Senha</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.tutor}</p>
                    <p className="text-xs text-muted-foreground">{e.pet} • CPF {e.cpf || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.tipo || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.login_informado ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.senha_informada ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={e.status}
                      onChange={(ev) => updateStatus(e.id, ev.target.value as ExameStatus)}
                      className="h-9 px-2 bg-background ring-1 ring-black/5 rounded-lg text-xs"
                    >
                      {(Object.keys(STATUS_LABEL) as ExameStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => remove(e.id)}
                      className="text-muted-foreground hover:text-urgent"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <FormDialog onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Nova solicitação de exame</h2>
            <Grid>
              <Field label="Nome do tutor *">
                <Input value={form.tutor} onChange={(v) => setForm({ ...form, tutor: v })} />
              </Field>
              <Field label="CPF">
                <Input value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
              </Field>
              <Field label="Nome do pet *">
                <Input value={form.pet} onChange={(v) => setForm({ ...form, pet: v })} />
              </Field>
              <Field label="Tipo de exame">
                <Input value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} />
              </Field>
              <Field label="Link do laboratório">
                <Input value={form.link_lab} onChange={(v) => setForm({ ...form, link_lab: v })} />
              </Field>
              <Field label="Login informado">
                <label className="flex items-center gap-2 h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm">
                  <input
                    type="checkbox"
                    checked={form.login_informado}
                    onChange={(ev) => setForm({ ...form, login_informado: ev.target.checked })}
                  />
                  Sim
                </label>
              </Field>
              <Field label="Senha informada">
                <label className="flex items-center gap-2 h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm">
                  <input
                    type="checkbox"
                    checked={form.senha_informada}
                    onChange={(ev) => setForm({ ...form, senha_informada: ev.target.checked })}
                  />
                  Sim
                </label>
              </Field>
            </Grid>
            <DialogFooter onCancel={() => setOpen(false)} submitLabel="Registrar" />
          </form>
        </FormDialog>
      )}
    </div>
  );
}
