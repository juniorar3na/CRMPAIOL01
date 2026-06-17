import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format, isBefore, startOfDay, addMonths } from "date-fns";
import { Plus, Building2, Trash2, Edit } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { DbClinica } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/agencia/clinicas")({
  head: () => ({ meta: [{ title: "Clínicas — Super Admin" }] }),
  component: ClinicasPage,
});

type FormState = {
  nome: string;
  rede: string;
  cnpj: string;
  responsavel: string;
  telefone: string;
  email: string;
  plano: string;
  status_contrato: string;
  status: string;
  limite_whatsapp: number;
  limite_unidades: number;
  dia_vencimento: number | "";
};

const EMPTY: FormState = {
  nome: "",
  rede: "",
  cnpj: "",
  responsavel: "",
  telefone: "",
  email: "",
  plano: "",
  status_contrato: "ativo",
  status: "ativo",
  limite_whatsapp: 1,
  limite_unidades: 1,
  dia_vencimento: new Date().getDate(),
};

function ClinicasPage() {
  const [items, setItems] = useState<DbClinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clinicas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome da clínica");
    
    const payload = {
      ...form,
      dia_vencimento: form.dia_vencimento === "" ? null : form.dia_vencimento,
    };

    if (editingId) {
      // Remover campos que não queremos atualizar com string vazia ou que não existem no DB caso seja nulo? 
      // FormState já está limpo.
      const { error } = await supabase.from("clinicas").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Clínica atualizada com sucesso");
    } else {
      const { error } = await supabase.from("clinicas").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Clínica cadastrada com sucesso");
    }

    setForm(EMPTY);
    setEditingId(null);
    setOpen(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Tem certeza absoluta? Isso excluirá a clínica e todas as suas unidades, conversas e configurações permanentemente!")) return;
    const { error } = await supabase.from("clinicas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Clínica removida");
    carregar();
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "ativo" ? "inativo" : "ativo";
    
    // Quando ativado, define o dia de vencimento baseado no dia atual
    const updatePayload: any = { status: newStatus };
    if (newStatus === "ativo") {
      const today = new Date();
      updatePayload.dia_vencimento = today.getDate();
      updatePayload.proximo_vencimento = addMonths(today, 1).toISOString();
    }

    const { error } = await supabase.from("clinicas").update(updatePayload).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Clínica ${newStatus === "ativo" ? "ativada" : "desativada"} com sucesso`);
    carregar();
  }

  async function marcarComoPago(id: string, currentProximo: string | null, diaVencimento: number | null) {
    let nextDate;
    if (currentProximo) {
      nextDate = addMonths(new Date(currentProximo), 1);
    } else {
      nextDate = addMonths(new Date(), 1);
      if (diaVencimento) nextDate.setDate(diaVencimento);
    }
    
    const { error } = await supabase.from("clinicas").update({ proximo_vencimento: nextDate.toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado! Vencimento atualizado para o próximo mês.");
    carregar();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Super Admin — Gerenciamento de Clínicas"
        description="Painel exclusivo do Dono do SaaS para cadastrar clínicas, configurar limites de operação e gerenciar contas."
        actions={
          <button
            onClick={() => {
              setForm(EMPTY);
              setEditingId(null);
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 h-10 px-4 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand/90"
          >
            <Plus className="size-4" /> Nova clínica
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Nenhuma clínica cadastrada ainda"
          description="Comece cadastrando a primeira clínica ou rede atendida."
        />
      ) : (
        <div className="bg-card ring-1 ring-black/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Clínica</th>
                <th className="px-4 py-3 font-medium">Rede</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Limites (Wpp / Unid)</th>
                <th className="px-4 py-3 font-medium">Status / Plano</th>
                <th className="px-4 py-3 font-medium text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {c.nome}
                      {c.status === "inativo" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                          Desativada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.rede || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.responsavel || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.limite_whatsapp ?? 1} / {c.limite_unidades ?? 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          c.status === "ativo"
                            ? "bg-brand-surface text-brand"
                            : c.status === "pendente"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1 mt-0.5">
                        {c.plano || "Sem plano"} 
                        {c.proximo_vencimento ? (
                          <>
                            • Vence: {format(new Date(c.proximo_vencimento), "dd/MM/yy")}
                            {isBefore(startOfDay(new Date(c.proximo_vencimento)), startOfDay(new Date())) && (
                              <span className="bg-rose-100 text-rose-700 font-bold px-1 py-0.5 rounded uppercase text-[9px] ml-1">
                                Atrasado
                              </span>
                            )}
                          </>
                        ) : c.dia_vencimento ? ` • Vence dia ${c.dia_vencimento}` : ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === "ativo" && (c.dia_vencimento || c.proximo_vencimento) && (
                        <button
                          onClick={() => marcarComoPago(c.id, c.proximo_vencimento, c.dia_vencimento)}
                          className="text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded transition-colors mr-1"
                        >
                          Pago
                        </button>
                      )}
                      <button
                        onClick={() => toggleStatus(c.id, c.status)}
                        className="text-[11px] font-medium text-brand hover:underline mr-1"
                      >
                        {c.status === "ativo" ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => {
                          setForm({
                            nome: c.nome,
                            rede: c.rede || "",
                            cnpj: c.cnpj || "",
                            responsavel: c.responsavel || "",
                            telefone: c.telefone || "",
                            email: c.email || "",
                            plano: c.plano || "",
                            status_contrato: c.status_contrato || "ativo",
                            status: c.status || "ativo",
                            limite_whatsapp: c.limite_whatsapp ?? 1,
                            limite_unidades: c.limite_unidades ?? 1,
                            dia_vencimento: c.dia_vencimento ?? "",
                          });
                          setEditingId(c.id);
                          setOpen(true);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Editar clínica"
                      >
                        <Edit className="size-4" />
                      </button>
                      <button
                        onClick={() => excluir(c.id)}
                        className="text-muted-foreground hover:text-urgent"
                        title="Excluir clínica permanentemente"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <FormDialog onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Cadastrar clínica</h2>
            <Grid>
              <Field label="Nome da clínica *">
                <Input value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
              </Field>
              <Field label="Nome da rede">
                <Input value={form.rede} onChange={(v) => setForm({ ...form, rede: v })} />
              </Field>
              <Field label="CNPJ">
                <Input value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} />
              </Field>
              <Field label="Responsável">
                <Input value={form.responsavel} onChange={(v) => setForm({ ...form, responsavel: v })} />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
              </Field>
              <Field label="E-mail">
                <Input type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              </Field>
              <Field label="Status da Clínica">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm"
                >
                  <option value="ativo">Ativo</option>
                  <option value="pendente">Pendente</option>
                  <option value="inativo">Inativo</option>
                </select>
              </Field>
              <Field label="Tipo de Plano">
                <Input value={form.plano} onChange={(v) => setForm({ ...form, plano: v })} />
              </Field>
              <Field label="Dia de Vencimento">
                <Input 
                  type="number" 
                  value={form.dia_vencimento.toString()} 
                  onChange={(v) => {
                    const parsed = parseInt(v);
                    setForm({ ...form, dia_vencimento: isNaN(parsed) ? "" : parsed });
                  }} 
                />
              </Field>
              <Field label="Limite de conexões WhatsApp">
                <Input 
                  type="number" 
                  value={form.limite_whatsapp.toString()} 
                  onChange={(v) => setForm({ ...form, limite_whatsapp: parseInt(v) || 1 })} 
                />
              </Field>
              <Field label="Limite de unidades cadastradas">
                <Input 
                  type="number" 
                  value={form.limite_unidades.toString()} 
                  onChange={(v) => setForm({ ...form, limite_unidades: parseInt(v) || 1 })} 
                />
              </Field>
            </Grid>
            <DialogFooter onCancel={() => setOpen(false)} submitLabel={editingId ? "Salvar alterações" : "Cadastrar clínica"} />
          </form>
        </FormDialog>
      )}
    </div>
  );
}

// shared mini form primitives — preserved for outros arquivos
export function FormDialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-card rounded-2xl ring-1 ring-black/5 shadow-xl p-6 max-h-[90vh] overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
    />
  );
}

export function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
    />
  );
}

export function DialogFooter({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-10 px-4 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="h-10 px-4 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand/90"
      >
        {submitLabel}
      </button>
    </div>
  );
}
