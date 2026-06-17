import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getAgenciaConfigFn, updateAgenciaConfigFn } from "@/lib/agencia.functions";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Key, Cpu, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agencia/configuracoes-ia")({
  head: () => ({ meta: [{ title: "Configurações de IA — Agência" }] }),
  component: ConfiguracoesIaPage,
});

function ConfiguracoesIaPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getAgenciaConfig = useServerFn(getAgenciaConfigFn);
  const updateAgenciaConfig = useServerFn(updateAgenciaConfigFn);

  useEffect(() => {
    getAgenciaConfig().then((data: any) => {
      if (data) {
        setApiKey(data.openai_api_key || "");
        setModel(data.openai_model || "gpt-4o-mini");
      }
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      toast.error("Falha ao carregar as configurações");
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) {
      toast.error("A API Key da OpenAI é obrigatória.");
      return;
    }
    setSaving(true);
    try {
      await updateAgenciaConfig({ data: { openai_api_key: apiKey, openai_model: model } });
      toast.success("Configurações salvas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar as configurações");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Inteligência Artificial (Global)"
        description="Configure a chave da API e o modelo padrão da OpenAI. Estas configurações serão usadas por todas as clínicas e unidades no Agente de IA e Base de Conhecimento."
      />

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-brand" />
        </div>
      ) : (
        <div className="bg-card border border-black/5 rounded-xl p-6 shadow-sm space-y-8">
          <div className="flex items-center gap-3 border-b border-black/5 pb-4">
            <Bot className="size-6 text-brand" />
            <h2 className="text-xl font-semibold">Configuração da OpenAI</h2>
          </div>

          <div className="space-y-6 max-w-2xl">
            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Key className="size-4 text-muted-foreground" />
                API Key (OpenAI)
              </label>
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Gere esta chave no painel de desenvolvedores da OpenAI. Ela será armazenada com segurança e nunca exibida nos painéis das clínicas.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="size-4 text-muted-foreground" />
                Modelo Padrão
              </label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Mais rápido e barato)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (Mais inteligente)</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Legado)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Recomendamos o "GPT-4o Mini" para assistentes de WhatsApp devido ao excelente balanço entre custo e inteligência.
              </p>
            </div>

            <div className="pt-4 border-t border-black/5 flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-brand text-brand-foreground hover:bg-brand/90">
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Salvar Configurações Globais
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
