import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------

type WuzapiEnv = {
  url: string;
  adminToken: string;
};

function getWuzapiEnv(): WuzapiEnv {
  const url = process.env.WUZAPI_URL;
  const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
  if (!url || !adminToken) {
    throw new Error(
      "WUZAPI não configurada. Defina WUZAPI_URL e WUZAPI_ADMIN_TOKEN nos secrets.",
    );
  }
  return { url: url.replace(/\/$/, ""), adminToken };
}

export async function wuzapi(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ ok: boolean; status: number; data: any; url: string }> {
  const { url } = getWuzapiEnv();
  const fullUrl = `${url}${path}`;
  const method = init.method ?? "GET";
  console.log("[wuzapi] →", method, fullUrl, init.body ? { body: init.body } : "");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...init.headers,
  };

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  console.log("[wuzapi] ←", method, fullUrl, "status=", res.status, "body=", text);
  return { ok: res.ok, status: res.status, data, url: fullUrl };
}

export function publicBaseUrl(): string | null {
  const raw =
    process.env.WEBHOOK_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? "";
  const base = raw.trim().replace(/\/$/, "");
  if (!base) {
    return null;
  }
  return base;
}

// ---------- inputs ----------

const InstanceInput = z.object({
  unidadeId: z.string(),
  instanceName: z.string().min(1).max(120),
  phoneNumber: z.string().optional().nullable(),
});

// ---------- server fns ----------

/**
 * Cria a instância na Wuzapi. Apenas registra o usuário e webhook (se disponível).
 */
export const wuzapiCreateInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InstanceInput.parse(input))
  .handler(async ({ data }) => {
    const { adminToken } = getWuzapiEnv();
    const base = publicBaseUrl();
    const userToken = `token_${data.instanceName}_${Date.now()}`;

    // 1. Criar o usuário (instância)
    const create = await wuzapi("/admin/users", {
      method: "POST",
      headers: { "Authorization": adminToken },
      body: { name: data.instanceName, token: userToken },
    });

    if (!create.ok) {
      throw new Error(`Falha ao criar usuário na Wuzapi (${create.status}): ${JSON.stringify(create.data)}`);
    }

    // 2. Configurar Webhook apenas se base URL existir
    let webhookConfigured = false;
    if (base) {
      const webhookUrl = `${base}/api/public/whatsapp/webhook/${encodeURIComponent(
        data.instanceName,
      )}?unidade=${data.unidadeId}`;
      await wuzapi("/webhook", {
        method: "POST",
        headers: { "token": userToken },
        body: {
          WebhookURL: webhookUrl,
          Events: ["Message"]
        }
      });
      webhookConfigured = true;
    } else {
      console.warn("[wuzapi] WEBHOOK_BASE_URL ausente ou inválido. Pulando configuração de webhook.");
    }

    return {
      apiToken: userToken, // Guardar o token no db
      webhookConfigured,
      message: "Instância criada com sucesso.",
    };
  });

/**
 * Gera o QR Code: Inicia a sessão e depois busca o QR Code.
 */
export const wuzapiGenerateQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    // 1. Iniciar conexão
    const connect = await wuzapi("/session/connect", {
      method: "POST",
      headers: { "token": data.apiToken },
      body: { Immediate: false, Subscribe: ["Message"] } // Esperar gerar QR
    });

    if (!connect.ok) {
      throw new Error(`Falha ao conectar sessão (${connect.status}): ${JSON.stringify(connect.data)}`);
    }

    // 2. Buscar QR Code
    const qrRes = await wuzapi("/session/qr", {
      method: "GET",
      headers: { "token": data.apiToken }
    });

    let qrBase64 = qrRes.data?.data?.QRCode ?? null;
    if (qrBase64 && !qrBase64.startsWith("data:image")) {
      qrBase64 = `data:image/png;base64,${qrBase64}`;
    }

    return {
      qrCode: qrBase64,
      qrText: null,
      pairingCode: null,
      state: "aguardando_qr",
    };
  });


export const wuzapiFetchQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const qrRes = await wuzapi("/session/qr", {
      method: "GET",
      headers: { "token": data.apiToken }
    });

    let qrBase64 = qrRes.data?.data?.QRCode ?? null;
    if (qrBase64 && !qrBase64.startsWith("data:image")) {
      qrBase64 = `data:image/png;base64,${qrBase64}`;
    }

    const statusRes = await wuzapi("/session/status", {
      method: "GET",
      headers: { "token": data.apiToken }
    });

    const { connected, loggedIn, Connected, LoggedIn } = statusRes.data?.data ?? {};
    const isLoggedIn = loggedIn ?? LoggedIn;
    const isConnected = connected ?? Connected;
    
    let state = "aguardando_qr";
    if (statusRes.ok) {
      if (isLoggedIn) state = "conectado";
      else if (!isConnected) state = "desconectado";
    }

    return {
      qrCode: qrBase64,
      qrText: null,
      pairingCode: null,
      state,
    };
  });

export const wuzapiFetchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const statusRes = await wuzapi("/session/status", {
      method: "GET",
      headers: { "token": data.apiToken }
    });

    if (!statusRes.ok) {
      return { status: "erro", numero: null, raw: statusRes.data };
    }

    const { connected, loggedIn, Connected, LoggedIn } = statusRes.data?.data ?? {};
    const isLoggedIn = loggedIn ?? LoggedIn;
    const isConnected = connected ?? Connected;
    
    let status = "desconectado";
    if (isLoggedIn) status = "conectado";
    else if (isConnected) status = "aguardando_qr";

    return { status, numero: null, raw: statusRes.data };
  });

export const wuzapiDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await wuzapi("/session/logout", {
      method: "POST",
      headers: { "token": data.apiToken }
    });
    return { ok: res.ok, raw: res.data };
  });

export const wuzapiRestart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await wuzapi("/session/connect", {
      method: "POST",
      headers: { "token": data.apiToken },
      body: { Immediate: true, Subscribe: ["Message"] }
    });
    return { ok: res.ok, raw: res.data };
  });

export const wuzapiDeleteInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { adminToken } = getWuzapiEnv();

    const usersRes = await wuzapi("/admin/users", {
      method: "GET",
      headers: { "Authorization": adminToken }
    });

    if (usersRes.ok && usersRes.data?.data) {
      const user = usersRes.data.data.find((u: any) => u.token === data.apiToken);
      if (user && user.id) {
        await wuzapi(`/admin/users/${user.id}`, {
          method: "DELETE",
          headers: { "Authorization": adminToken }
        });
      }
    }

    return { ok: true };
  });

export const wuzapiFetchProfilePicture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiToken: z.string().min(1), phoneNumber: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await wuzapi("/user/avatar", {
      method: "POST",
      headers: { "token": data.apiToken },
      body: { Phone: data.phoneNumber, Preview: true }
    });
    return { url: res.data?.url ?? res.data?.URL ?? null };
  });
