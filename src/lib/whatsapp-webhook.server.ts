import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOpenAI } from "./ia.functions";
import { wuzapi } from "./whatsapp.functions";

function pickQrFromPayload(payload: any): {
  base64: string | null;
  code: string | null;
  pairing: string | null;
} {
  const d = payload?.data ?? payload ?? {};
  const qr = d.qrcode ?? d.qrCode ?? d.qr ?? {};
  const base64 =
    (typeof qr === "string" ? qr : null) ??
    (typeof qr.base64 === "string" ? qr.base64 : null) ??
    (typeof d.base64 === "string" ? d.base64 : null) ??
    null;
  const code =
    (typeof qr.code === "string" ? qr.code : null) ??
    (typeof d.code === "string" ? d.code : null) ??
    null;
  const pairing =
    (typeof qr.pairingCode === "string" ? qr.pairingCode : null) ??
    (typeof d.pairingCode === "string" ? d.pairingCode : null) ??
    null;
  return { base64, code, pairing };
}

export async function handleWhatsappWebhook(
  request: Request,
  routeInstanceName: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const secretParam = url.searchParams.get("secret") ?? "";
  const unidadeId = url.searchParams.get("unidade") ?? "";
  // Verificação de secret removida temporariamente para a WUZAPI
  // const expected = process.env.EVOLUTION_WEBHOOK_SECRET ?? "";
  // if (!expected || secretParam !== expected) {
  //   return new Response("Invalid signature", { status: 401 });
  // }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const rawEvent: string | undefined = payload?.event;
  const event = rawEvent?.toLowerCase().replace(/[._-]/g, ".");
  const instance: string | undefined =
    payload?.instance ?? routeInstanceName ?? undefined;

  try {
    if (instance) {
      const patch: Record<string, any> = {
        last_seen_at: new Date().toISOString(),
      };

      if (event === "qrcode.updated") {
        const { base64, code, pairing } = pickQrFromPayload(payload);
        let qrValue: string | null = null;
        if (base64) {
          qrValue = base64.startsWith("data:image")
            ? base64
            : `data:image/png;base64,${base64}`;
        } else if (code) {
          qrValue = `qrtext:${code}`;
        } else if (pairing) {
          qrValue = `pairing:${pairing}`;
        }
        if (qrValue) patch.qr_code = qrValue;
        patch.status = "aguardando_qr";
      } else if (event === "connection.update") {
        const state: string | undefined = payload?.data?.state;
        if (state === "open") {
          patch.status = "conectado";
          patch.connected_at = new Date().toISOString();
          patch.qr_code = null;
          const owner: string | undefined =
            payload?.data?.wuid ?? payload?.data?.ownerJid;
          if (owner) patch.numero_conectado = owner.split("@")[0];
        } else if (state === "connecting") {
          patch.status = "aguardando_qr";
        } else if (state === "close") {
          patch.status = "desconectado";
        }
      } else if (event === "message") {
        // Processar mensagens recebidas para a IA
        const messageInfo = payload?.data?.info;
        const messageData = payload?.data?.message;

        if (messageInfo && messageData) {
          const isGroup = messageInfo.MessageSource?.IsGroup === true || messageInfo.RemoteJid?.endsWith("@g.us");
          const fromMe = messageInfo.FromMe === true;
          const remoteJid = messageInfo.RemoteJid;
          const messageText = messageData.conversation || messageData.extendedTextMessage?.text || "";

          if (remoteJid && messageText) {
            // Verificar sessão e se IA está ativa
            const { data: session } = await supabaseAdmin
              .from("whatsapp_sessoes" as any)
              .select("id, ia_ativa, ia_prompt, api_token")
              .eq("instance_name", instance)
              .maybeSingle();

            if (session) {
              // 1. Salvar mensagem recebida na memória
              await supabaseAdmin.from("whatsapp_mensagens" as any).insert({
                sessao_id: session.id,
                remote_jid: remoteJid,
                mensagem: messageText,
                from_me: fromMe,
                message_id: messageInfo.Id
              });

              // 2. Processar com IA (ignorar grupos e mensagens enviadas por mim)
              if (session.ia_ativa && !isGroup && !fromMe) {
                try {
                  const { openai, model } = await getOpenAI();
                  
                  // 3. Carregar memória recente
                  const { data: history } = await supabaseAdmin
                    .from("whatsapp_mensagens" as any)
                    .select("mensagem, from_me")
                    .eq("sessao_id", session.id)
                    .eq("remote_jid", remoteJid)
                    .order("created_at", { ascending: false })
                    .limit(10);
                  
                  const messages: any[] = [
                    { role: "system", content: session.ia_prompt || "Você é um assistente virtual útil." }
                  ];

                  if (history && history.length > 0) {
                    // O banco traz os mais novos primeiro. Inverter para ordem cronológica.
                    const chronological = history.reverse();
                    // Ignorar a última mensagem que acabamos de inserir, pois a enviaremos separadamente
                    for (let i = 0; i < chronological.length - 1; i++) {
                      const h = chronological[i];
                      messages.push({
                        role: h.from_me ? "assistant" : "user",
                        content: h.mensagem
                      });
                    }
                  }

                  messages.push({ role: "user", content: messageText });

                  // 4. Gerar resposta
                  const completion = await openai.chat.completions.create({
                    model: model,
                    messages: messages,
                  });

                  const replyText = completion.choices[0]?.message?.content;

                  if (replyText) {
                    // 5. Enviar resposta via Wazup
                    const sendRes = await wuzapi("/chat/send/text", {
                      method: "POST",
                      headers: { "token": session.api_token },
                      body: {
                        Phone: remoteJid.split("@")[0],
                        Body: replyText
                      }
                    });

                    if (sendRes.ok) {
                      // 6. Salvar resposta da IA na memória
                      await supabaseAdmin.from("whatsapp_mensagens" as any).insert({
                        sessao_id: session.id,
                        remote_jid: remoteJid,
                        mensagem: replyText,
                        from_me: true
                      });
                    } else {
                      console.error("[whatsapp webhook] Falha ao enviar IA:", sendRes);
                    }
                  }

                } catch (aiErr: any) {
                  console.error("[whatsapp webhook] Erro IA:", aiErr?.message || aiErr);
                }
              }
            }
          }
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from("whatsapp_sessoes" as any)
        .update(patch)
        .eq("instance_name", instance);

      console.log("[whatsapp webhook]", {
        event: rawEvent,
        normalized: event,
        instance,
        unidadeId,
        patchKeys: Object.keys(patch),
        hasQr: typeof patch.qr_code === "string",
        updateError: updateError?.message ?? null,
      });
    } else {
      console.log("[whatsapp webhook] sem instance", {
        event: rawEvent,
        payloadKeys: Object.keys(payload ?? {}),
      });
    }
  } catch (err) {
    console.error("[whatsapp webhook] erro:", err);
  }

  return new Response("ok", { status: 200 });
}
