import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import OpenAI from "openai";

export async function getOpenAI() {
  const { data } = await (supabaseAdmin as any)
    .from("agencia_configuracoes")
    .select("openai_api_key, openai_model")
    .eq("id", 1)
    .maybeSingle();

  const apiKey = (data as any)?.openai_api_key;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no painel da agência.");
  }
  return {
    openai: new OpenAI({ apiKey }),
    model: data?.openai_model || "gpt-4o-mini",
  };
}

export const updateIaSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sessaoId: z.string().uuid(),
      iaAtiva: z.boolean(),
      iaPrompt: z.string().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Salva as configurações no banco
    const { error } = await (supabase as any)
      .from("whatsapp_sessoes")
      .update({
        ia_ativa: data.iaAtiva,
        ia_prompt: data.iaPrompt,
      })
      .eq("id", data.sessaoId);

    if (error) {
      throw new Error("Erro ao salvar configurações da IA: " + error.message);
    }

    // 2. Chama o backend Node.js de IA para registrar/remover webhook na WUZAPI
    // AI_BACKEND_URL = URL interna do servidor Node.js (Portainer em prod, localhost em dev)
    const aiBackendUrl = process.env.AI_BACKEND_URL || "http://127.0.0.1:3001";
    const endpoint = data.iaAtiva
      ? `${aiBackendUrl}/ai/${data.sessaoId}/activate`
      : `${aiBackendUrl}/ai/${data.sessaoId}/deactivate`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = (await res.json()) as { success: boolean; error?: string };
      if (!result.success) {
        console.warn(result.error || "Erro ao comunicar com o servidor de IA");
      }
    } catch (err: any) {
      console.warn(
        `Falha ao ${data.iaAtiva ? "ativar" : "desativar"} IA no servidor: ${err.message}`,
      );
    }

    return { success: true };
  });
