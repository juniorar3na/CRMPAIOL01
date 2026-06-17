import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const WUZAPI_URL = process.env.WUZAPI_URL!.replace(/\/$/, "");
const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL!.replace(/\/$/, "");

async function run() {
  console.log("Buscando sessão unid-centro no Supabase...");
  const { data: sessoes, error } = await supabase
    .from("whatsapp_sessoes")
    .select("id, api_token, instance_name, unidade_id")
    .eq("instance_name", "unid-centro");

  if (error || !sessoes || sessoes.length === 0) {
    console.error("Erro ou nenhuma sessão encontrada", error);
    return;
  }

  const sessao = sessoes[0];
  if (!sessao.api_token) {
    console.error("Sessão encontrada mas não possui api_token");
    return;
  }

  const webhookUrl = `${WEBHOOK_BASE}/api/public/whatsapp/webhook/${encodeURIComponent(
    sessao.instance_name
  )}?unidade=${sessao.unidade_id}`;

  console.log(`Configurando webhook para: ${webhookUrl}`);

  const res = await fetch(`${WUZAPI_URL}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "token": sessao.api_token
    },
    body: JSON.stringify({
      WebhookURL: webhookUrl,
      Events: ["Message"]
    })
  });

  const text = await res.text();
  console.log("WUZAPI Status:", res.status);
  console.log("WUZAPI Response:", text);
}

run().catch(console.error);
