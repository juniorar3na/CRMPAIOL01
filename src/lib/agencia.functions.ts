import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAgenciaConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
  const { data, error } = await (supabase as any)
    .from("agencia_configuracoes")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar configurações da agência:", error);
  }

  return (data as any) ?? { openai_api_key: "", openai_model: "gpt-4o-mini" };
  });

export const updateAgenciaConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      openai_api_key: z.string().min(1, "A API Key é obrigatória"),
      openai_model: z.string().min(1, "O modelo é obrigatório"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await (supabase as any).from("agencia_configuracoes").upsert({
      id: 1,
      openai_api_key: data.openai_api_key,
      openai_model: data.openai_model,
    });

    if (error) {
      throw new Error("Erro ao salvar configurações globais: " + error.message);
    }

    return { success: true };
  });
