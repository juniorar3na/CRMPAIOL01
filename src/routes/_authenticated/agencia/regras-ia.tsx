import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentScope } from "@/lib/scope";
import {
  Field,
  Textarea,
  Input,
} from "@/routes/_authenticated/agencia/clinicas";

export const Route = createFileRoute("/_authenticated/agencia/regras-ia")({
  head: () => ({ meta: [{ title: "Regras da IA" }] }),
  component: RegrasIAPage,
});

type Form = {
  mensagem_boas_vindas: string;
  tom_de_voz: string;
  quando_responder_sozinha: string;
  quando_chamar_humano: string;
  palavras_urgencia: string; // CSV
  servicos_precisam_humano: string; // CSV
  informacoes_proibidas: string;
  mensagem_casos_sensiveis: string;
};

const EMPTY: Form = {
  mensagem_boas_vindas: "",
  tom_de_voz: "",
  quando_responder_sozinha: "",
  quando_chamar_humano: "",
  palavras_urgencia: "",
  servicos_precisam_humano: "",
  informacoes_proibidas: "",
  mensagem_casos_sensiveis: "",
};

function RegrasIAPage() {
  const { clinicaId, unidadeId } = useCurrentScope();
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicaId) return;
    (async () => {
      let q = supabase
        .from("regras_ia")
        .select("*")
        .eq("clinica_id", clinicaId);
        
      if (unidadeId) {
        q = q.eq("unidade_id", unidadeId);
      } else {
        q = q.is("unidade_id", null);
      }
      
      const { data } = await q.maybeSingle();
      if (data) {
        setExistingId(data.id);
        setForm({
          mensagem_boas_vindas: data.mensagem_boas_vindas ?? "",
          tom_de_voz: data.tom_de_voz ?? "",
          quando_responder_sozinha: data.quando_responder_sozinha ?? "",
          quando_chamar_humano: data.quando_chamar_humano ?? "",
          palavras_urgencia: (data.palavras_urgencia ?? []).join(", "),
          servicos_precisam_humano: (data.servicos_precisam_humano ?? []).join(", "),
          informacoes_proibidas: data.informacoes_proibidas ?? "",
          mensagem_casos_sensiveis: data.mensagem_casos_sensiveis ?? "",
        });
      } else {
        setExistingId(null);
        setForm(EMPTY);
      }
    })();
  }, [clinicaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicaId) return toast.error("Selecione a clínica");
    setSaving(true);
    const payload = {
      clinica_id: clinicaId,
      unidade_id: unidadeId,
      mensagem_boas_vindas: form.mensagem_boas_vindas || null,
      tom_de_voz: form.tom_de_voz || null,
      quando_responder_sozinha: form.quando_responder_sozinha || null,
      quando_chamar_humano: form.quando_chamar_humano || null,
      palavras_urgencia: form.palavras_urgencia
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      servicos_precisam_humano: form.servicos_precisam_humano
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      informacoes_proibidas: form.informacoes_proibidas || null,
      mensagem_casos_sensiveis: form.mensagem_casos_sensiveis || null,
    };
    const { error } = existingId
      ? await supabase.from("regras_ia").update(payload).eq("id", existingId)
      : await supabase.from("regras_ia").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Regras salvas");
  }

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Regras da IA"
        description="Defina o comportamento da IA: quando responder, quando passar para a recepção e o que nunca pode dizer."
      />
      <form onSubmit={handleSubmit} className="space-y-5">

        <Field label="Mensagem de boas-vindas">
          <Textarea
            value={form.mensagem_boas_vindas}
            onChange={(v) => set("mensagem_boas_vindas", v)}
            placeholder="Olá! Aqui é a recepção da Clínica…"
          />
        </Field>
        <Field label="Tom de voz">
          <Input
            value={form.tom_de_voz}
            onChange={(v) => set("tom_de_voz", v)}
            placeholder="Ex: acolhedor, direto, profissional"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Quando a IA pode responder sozinha">
            <Textarea
              value={form.quando_responder_sozinha}
              onChange={(v) => set("quando_responder_sozinha", v)}
            />
          </Field>
          <Field label="Quando deve chamar humano">
            <Textarea
              value={form.quando_chamar_humano}
              onChange={(v) => set("quando_chamar_humano", v)}
            />
          </Field>
        </div>
        <Field label="Palavras de urgência (separadas por vírgula)">
          <Input
            value={form.palavras_urgencia}
            onChange={(v) => set("palavras_urgencia", v)}
            placeholder="convulsão, sangramento, atropelado"
          />
        </Field>
        <Field label="Serviços que precisam de recepção (separados por vírgula)">
          <Input
            value={form.servicos_precisam_humano}
            onChange={(v) => set("servicos_precisam_humano", v)}
            placeholder="internação, eutanásia, cirurgia"
          />
        </Field>
        <Field label="Informações que a IA não pode passar">
          <Textarea
            value={form.informacoes_proibidas}
            onChange={(v) => set("informacoes_proibidas", v)}
          />
        </Field>
        <Field label="Mensagem padrão para casos sensíveis">
          <Textarea
            value={form.mensagem_casos_sensiveis}
            onChange={(v) => set("mensagem_casos_sensiveis", v)}
          />
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-5 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar regras"}
          </button>
        </div>
      </form>
    </div>
  );
}
