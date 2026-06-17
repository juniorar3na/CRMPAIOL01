import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useScope, useCurrentScope, unidadeNome } from "@/lib/scope";
import type { DbInternacao } from "@/lib/db-types";
import {
  FormDialog,
  Field,
  Grid,
  Input,
  Textarea,
  DialogFooter,
} from "@/routes/_authenticated/agencia/clinicas";

export const Route = createFileRoute("/_authenticated/recepcao/internacoes")({
  head: () => ({ meta: [{ title: "Internações — Recepção" }] }),
  component: InternacoesPage,
});

type Status = "aguardando equipe" | "respondido" | "finalizado";

type FormState = {
  tutor: string;
  cpf: string;
  pet: string;
  unidade_id: string;
  data: string;
  observacoes: string;
  mensagem_autorizada: string;
};

const EMPTY: FormState = {
  tutor: "",
  cpf: "",
  pet: "",
  unidade_id: "",
  data: new Date().toISOString().slice(0, 10),
  observacoes: "",
  mensagem_autorizada: "",
};

function InternacoesPage() {
  const { unidades } = useScope();
  const { clinicaId, unidadeId } = useCurrentScope();
  const [items, setItems] = useState<DbInternacao[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  async function load() {
    let q = supabase
      .from("internacoes")
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

  useEffect(() => {
    if (unidadeId && !form.unidade_id) setForm((f) => ({ ...f, unidade_id: unidadeId }));
  }, [unidadeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tutor || !form.pet) return toast.error("Informe tutor e pet");
    if (!clinicaId) return toast.error("Clínica não identificada");
    const { error } = await supabase.from("internacoes").insert({
      tutor: form.tutor,
      cpf: form.cpf || null,
      pet: form.pet,
      data: form.data,
      observacoes: form.observacoes || null,
      mensagem_autorizada: form.mensagem_autorizada || null,
      clinica_id: clinicaId,
      unidade_id: form.unidade_id || unidadeId,
      status: "aguardando equipe",
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação registrada");
    setForm({ ...EMPTY, unidade_id: unidadeId ?? "" });
    setOpen(false);
    load();
  }

  async function updateStatus(id: string, status: Status) {
    const { error } = await supabase.from("internacoes").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("internacoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Atualizações de internação"
        description="Registre e acompanhe solicitações de tutores sobre pets internados."
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
          icon={<Stethoscope className="size-5" />}
          title="Nenhuma solicitação registrada"
          description="As solicitações aparecerão aqui assim que forem abertas."
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="bg-card ring-1 ring-black/5 rounded-xl p-5">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="font-semibold">
                    {it.pet} <span className="text-muted-foreground font-normal">• {it.tutor}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CPF {it.cpf || "—"} • Unidade {unidadeNome(unidades, it.unidade_id)} • {it.data}
                  </p>
                  {it.observacoes && (
                    <p className="text-sm mt-3 text-muted-foreground">{it.observacoes}</p>
                  )}
                  {it.mensagem_autorizada && (
                    <p className="text-sm mt-3 p-3 bg-brand-surface text-brand rounded-lg">
                      {it.mensagem_autorizada}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={it.status}
                    onChange={(e) => updateStatus(it.id, e.target.value as Status)}
                    className="h-9 px-2 bg-background ring-1 ring-black/5 rounded-lg text-xs"
                  >
                    <option value="aguardando equipe">Aguardando equipe</option>
                    <option value="respondido">Respondido</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                  <button
                    onClick={() => remove(it.id)}
                    className="text-muted-foreground hover:text-urgent"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <FormDialog onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Nova solicitação de internação</h2>
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
              <Field label="Unidade">
                <select
                  value={form.unidade_id}
                  onChange={(e) => setForm({ ...form, unidade_id: e.target.value })}
                  className="h-10 w-full px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm"
                >
                  <option value="">—</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data da solicitação">
                <Input
                  type="date"
                  value={form.data}
                  onChange={(v) => setForm({ ...form, data: v })}
                />
              </Field>
            </Grid>
            <Field label="Observações internas">
              <Textarea
                value={form.observacoes}
                onChange={(v) => setForm({ ...form, observacoes: v })}
              />
            </Field>
            <Field label="Mensagem autorizada para o tutor">
              <Textarea
                value={form.mensagem_autorizada}
                onChange={(v) => setForm({ ...form, mensagem_autorizada: v })}
              />
            </Field>
            <DialogFooter onCancel={() => setOpen(false)} submitLabel="Registrar solicitação" />
          </form>
        </FormDialog>
      )}
    </div>
  );
}
