import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsappWebhook } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWhatsappWebhook(request, null),
      GET: async () => new Response("ok"),
    },
  },
});
