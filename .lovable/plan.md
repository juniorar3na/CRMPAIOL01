## Objetivo

Garantir que o QR Code apareça na tela mesmo quando o webhook da Evolution falhar/atrasar, e ao mesmo tempo deixar o webhook robusto para o caminho feliz.

## 1. Polling no frontend (UX confiável)

Em `src/routes/_authenticated/conexao-whatsapp.tsx`:

- Criar um novo server fn `evolutionFetchQr({ instanceName })` em `src/lib/whatsapp.functions.ts` que chama `GET /instance/connect/{instanceName}` na Evolution e retorna `{ qrCode, qrText, pairingCode, state }`. Esse endpoint, quando a instância existe e ainda não conectou, devolve um QR novo.
- Quando `handleGerarQr` retornar `pending: true` (ou mesmo sem QR), iniciar um **polling a cada 2s, por até 60s**, chamando `evolutionFetchQr`. A cada resposta:
  - Se vier `qrCode`/`qrText`/`pairingCode` → `upsertSessao({ status: "aguardando_qr", qr_code: ... })` e parar o polling.
  - Se `fetchStatus` indicar `conectado` → atualizar sessão e parar.
- Cancelar o polling ao trocar de unidade, desmontar, clicar em "Desconectar" ou após sucesso.
- Substituir o `setTimeout(3000)` atual por esse polling.

## 2. Diagnóstico e correção do webhook

- Adicionar log estruturado em `src/lib/whatsapp-webhook.server.ts`: logar `event`, `instance`, presença/ausência de QR, e erro de update (`error.message`) — hoje erros do Supabase update são silenciosos.
- Após o usuário gerar um QR, rodar:
  - `supabase--analytics_query` em `function_edge_logs` filtrando pela URL `/api/public/whatsapp/webhook` para confirmar se a Evolution está chamando.
  - `stack_modern--server-function-logs` com `search: "whatsapp webhook"` para ver o que chega.
- Possíveis ajustes conforme o que aparecer nos logs:
  - Aceitar variantes adicionais do nome do evento (`QRCODE_UPDATED`, `qrcode_updated`, `qrcode.updated` — o normalizador atual já cobre, mas confirmar).
  - Ampliar `pickQrFromPayload` para olhar `payload.data.qrcode.base64` quando a Evolution envia em formato aninhado (alguns builds enviam dentro de `instance`).
  - Se Evolution não chamar o webhook, verificar `WEBHOOK_BASE_URL` configurado no secret.

## 3. Critério de aceite

- Clicar em "Gerar QR Code" exibe o QR em até ~10s mesmo se o webhook não chegar (via polling).
- Quando o webhook chega, o QR aparece em <2s e logs mostram `event=QRCODE_UPDATED, qr=present, updated=ok`.
- Ao escanear, status muda para "conectado" automaticamente (via webhook `connection.update` que já está implementado).

## Arquivos a alterar

- `src/lib/whatsapp.functions.ts` — adicionar `evolutionFetchQr`.
- `src/routes/_authenticated/conexao-whatsapp.tsx` — substituir setTimeout por polling com cleanup.
- `src/lib/whatsapp-webhook.server.ts` — logs mais detalhados e ajustes em `pickQrFromPayload` se necessário após ver os logs reais.
