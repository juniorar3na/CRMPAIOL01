import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, BookOpen, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentScope } from "@/lib/scope";
import { CATEGORIAS_BASE, type DbBaseItem } from "@/lib/db-types";
import {
  FormDialog,
  Field,
  Input,
  Textarea,
  DialogFooter,
} from "@/routes/_authenticated/agencia/clinicas";

export const Route = createFileRoute("/_authenticated/agencia/base-conhecimento")({
  head: () => ({ meta: [{ title: "Base de conhecimento" }] }),
  component: BasePage,
});

function BasePage() {
  const { clinicaId, unidadeId } = useCurrentScope();
  const [items, setItems] = useState<DbBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    categoria: string;
    titulo: string;
    conteudo: string;
  }>({
    categoria: CATEGORIAS_BASE[0],
    titulo: "",
    conteudo: "",
  });

  async function carregar() {
    setLoading(true);
    let q = supabase
      .from("base_conhecimento")
      .select("*")
      .order("categoria");
      
    if (clinicaId) q = q.eq("clinica_id", clinicaId);
    if (unidadeId) {
      q = q.eq("unidade_id", unidadeId);
    } else if (clinicaId) {
      q = q.is("unidade_id", null);
    }

    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [clinicaId, unidadeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.conteudo.trim())
      return toast.error("Preencha título e conteúdo");
    if (!clinicaId) return toast.error("Selecione uma clínica no seletor global");
    
    const { error } = await supabase.from("base_conhecimento").insert({
      clinica_id: clinicaId,
      unidade_id: unidadeId,
      categoria: form.categoria,
      titulo: form.titulo,
      conteudo: form.conteudo,
    });
    
    if (error) return toast.error(error.message);
    toast.success("Resposta cadastrada");
    setForm({ categoria: CATEGORIAS_BASE[0], titulo: "", conteudo: "" });
    setOpen(false);
    carregar();
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("base_conhecimento").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    carregar();
  }

  const byCat = CATEGORIAS_BASE.map((cat) => ({
    cat,
    items: items.filter((i) => i.categoria === cat),
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Base de conhecimento"
        description="Respostas e informações que a IA pode usar nos atendimentos da clínica."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand/90"
          >
            <Plus className="size-4" /> Nova resposta
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="Base vazia"
          description="Cadastre respostas por categoria para alimentar a IA."
        />
      ) : (
        <div className="space-y-6">
          {byCat
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.cat}>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  {g.cat}
                </h3>
                <div className="space-y-2">
                  {g.items.map((it) => (
                    <div
                      key={it.id}
                      className="bg-card ring-1 ring-black/5 rounded-lg p-4 flex justify-between gap-4"
                    >
                      <div>
                        <p className="font-medium text-sm">{it.titulo}</p>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                          {it.conteudo}
                        </p>
                      </div>
                      <button
                        onClick={() => excluir(it.id)}
                        className="text-muted-foreground hover:text-urgent shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {open && (
        <FormDialog onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Nova resposta da base</h2>

            <Field label="Categoria">
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm"
              >
                {CATEGORIAS_BASE.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Título">
              <Input value={form.titulo} onChange={(v) => setForm({ ...form, titulo: v })} />
            </Field>
            <Field label="Conteúdo">
              <Textarea
                value={form.conteudo}
                onChange={(v) => setForm({ ...form, conteudo: v })}
                rows={5}
              />
            </Field>
            <DialogFooter onCancel={() => setOpen(false)} submitLabel="Salvar resposta" />
          </form>
        </FormDialog>
      )}
    </div>
  );
}
