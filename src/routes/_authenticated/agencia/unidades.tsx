import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, MapPin, Trash2, Edit2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useScope, useCurrentScope } from "@/lib/scope";
import type { DbUnidade } from "@/lib/db-types";
import {
  FormDialog,
  Field,
  Grid,
  Input,
  Textarea,
  DialogFooter,
} from "@/routes/_authenticated/agencia/clinicas";

export const Route = createFileRoute("/_authenticated/agencia/unidades")({
  head: () => ({ meta: [{ title: "Unidades — Super Admin" }] }),
  component: UnidadesPage,
});

type FormState = {
  clinica_id: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  horario_funcionamento: string;
  atende_24h: boolean;
  whatsapp: string;
  google_maps_url: string;
  laboratorio_url: string;
  servicos: string;
};

const EMPTY: FormState = {
  clinica_id: "",
  nome: "",
  endereco: "",
  bairro: "",
  cidade: "",
  horario_funcionamento: "",
  atende_24h: false,
  whatsapp: "",
  google_maps_url: "",
  laboratorio_url: "",
  servicos: "",
};

function UnidadesPage() {
  const { clinicaId } = useCurrentScope();
  const { clinicas } = useScope();
  const [items, setItems] = useState<DbUnidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  async function carregar() {
    setLoading(true);
    let q = supabase
      .from("unidades")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (clinicaId) q = q.eq("clinica_id", clinicaId);

    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [clinicaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome da unidade");
    if (!clinicaId) return toast.error("Selecione uma clínica no seletor global");
    
    const servicos = form.servicos
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingId) {
      const { error } = await supabase.from("unidades").update({
        nome: form.nome,
        endereco: form.endereco || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        horario_funcionamento: form.horario_funcionamento || null,
        atende_24h: form.atende_24h,
        whatsapp: form.whatsapp || null,
        google_maps_url: form.google_maps_url || null,
        laboratorio_url: form.laboratorio_url || null,
        servicos,
      }).eq("id", editingId);
      
      if (error) return toast.error(error.message);
      toast.success("Unidade atualizada");
    } else {
      const clinicaAtual = clinicas.find(c => c.id === clinicaId);
      if (clinicaAtual && items.length >= clinicaAtual.limite_unidades) {
        return toast.error(`Limite de unidades atingido para esta clínica (${clinicaAtual.limite_unidades}).`);
      }

      const { error } = await supabase.from("unidades").insert({
        clinica_id: clinicaId,
        nome: form.nome,
        endereco: form.endereco || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        horario_funcionamento: form.horario_funcionamento || null,
        atende_24h: form.atende_24h,
        whatsapp: form.whatsapp || null,
        google_maps_url: form.google_maps_url || null,
        laboratorio_url: form.laboratorio_url || null,
        servicos,
      });
      if (error) return toast.error(error.message);
      toast.success("Unidade cadastrada");
    }

    setForm(EMPTY);
    setEditingId(null);
    setOpen(false);
    carregar();
  }

  async function abrirEdicao(u: DbUnidade) {
    setForm({
      clinica_id: u.clinica_id,
      nome: u.nome,
      endereco: u.endereco || "",
      bairro: u.bairro || "",
      cidade: u.cidade || "",
      horario_funcionamento: u.horario_funcionamento || "",
      atende_24h: u.atende_24h,
      whatsapp: u.whatsapp || "",
      google_maps_url: u.google_maps_url || "",
      laboratorio_url: u.laboratorio_url || "",
      servicos: u.servicos.join(", "),
    });
    setEditingId(u.id);
    setOpen(true);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta unidade?")) return;
    const { error } = await supabase.from("unidades").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Unidade removida");
    carregar();
  }

  const clinicaAtual = clinicas.find(c => c.id === clinicaId);
  const reachedLimit = clinicaAtual ? items.length >= clinicaAtual.limite_unidades : false;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Unidades"
        description="Cadastre cada unidade física com horário, WhatsApp e serviços oferecidos."
        actions={
          <div className="flex items-center gap-4">
            {clinicaAtual && (
              <span className="text-xs text-muted-foreground font-medium">
                {items.length} / {clinicaAtual.limite_unidades} unidades permitidas
              </span>
            )}
            <button
              onClick={() => {
                if (reachedLimit) return toast.error(`Limite de unidades (${clinicaAtual?.limite_unidades}) atingido.`);
                setEditingId(null);
                setForm(EMPTY);
                setOpen(true);
              }}
              disabled={reachedLimit}
              className="inline-flex items-center gap-2 h-10 px-4 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="size-4" /> Nova unidade
            </button>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-5" />}
          title="Nenhuma unidade cadastrada"
          description="Cadastre unidades para começar a receber atendimentos via WhatsApp."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((u) => (
            <div key={u.id} className="bg-card ring-1 ring-black/5 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold tracking-tight">{u.nome}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {u.endereco || "Endereço não informado"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirEdicao(u)}
                    className="text-muted-foreground hover:text-brand"
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button
                    onClick={() => excluir(u.id)}
                    className="text-muted-foreground hover:text-urgent"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {u.atende_24h && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-surface text-brand">
                    24h
                  </span>
                )}
                {u.whatsapp && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground">
                    WhatsApp {u.whatsapp}
                  </span>
                )}
              </div>
              {u.horario_funcionamento && (
                <p className="text-xs text-muted-foreground mt-3">
                  Horário: {u.horario_funcionamento}
                </p>
              )}
              {u.servicos.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Serviços: {u.servicos.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <FormDialog onClose={() => { setOpen(false); setEditingId(null); setForm(EMPTY); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">{editingId ? "Editar unidade" : "Cadastrar unidade"}</h2>
            <Grid>

              <Field label="Nome da unidade *">
                <Input value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
              </Field>
              <Field label="Endereço">
                <Input
                  value={form.endereco}
                  onChange={(v) => setForm({ ...form, endereco: v })}
                />
              </Field>
              <Field label="Bairro">
                <Input value={form.bairro} onChange={(v) => setForm({ ...form, bairro: v })} />
              </Field>
              <Field label="Cidade">
                <Input value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
              </Field>
              <Field label="Horário de funcionamento">
                <Input
                  value={form.horario_funcionamento}
                  onChange={(v) => setForm({ ...form, horario_funcionamento: v })}
                  placeholder="Ex: Seg-Sex 8h-20h"
                />
              </Field>
              <Field label="Atendimento 24h">
                <label className="flex items-center gap-2 h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.atende_24h}
                    onChange={(e) => setForm({ ...form, atende_24h: e.target.checked })}
                  />
                  Sim, atende 24h
                </label>
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={(v) => setForm({ ...form, whatsapp: v })}
                />
              </Field>
              <Field label="Link do Google Maps">
                <Input
                  value={form.google_maps_url}
                  onChange={(v) => setForm({ ...form, google_maps_url: v })}
                />
              </Field>
              <Field label="Link do laboratório">
                <Input
                  value={form.laboratorio_url}
                  onChange={(v) => setForm({ ...form, laboratorio_url: v })}
                />
              </Field>
            </Grid>
            <Field label="Serviços (separados por vírgula)">
              <Textarea
                value={form.servicos}
                onChange={(v) => setForm({ ...form, servicos: v })}
                placeholder="Consulta, vacinas, exames, internação"
              />
            </Field>
            <DialogFooter onCancel={() => setOpen(false)} submitLabel={editingId ? "Salvar alterações" : "Cadastrar unidade"} />
          </form>
        </FormDialog>
      )}
    </div>
  );
}
