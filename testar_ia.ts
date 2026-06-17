import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from("whatsapp_sessoes").select("*").eq("instance_name", "unid-centro").single();
  console.log("IA Ativa:", data?.ia_ativa);
  console.log("Status:", data?.status);
  const { data: messages } = await supabase.from("whatsapp_mensagens").select("*").eq("sessao_id", data?.id);
  console.log("Total de Mensagens Recebidas:", messages?.length);
  console.log("Última mensagem:", messages?.[messages.length - 1]?.mensagem);
}
run();
