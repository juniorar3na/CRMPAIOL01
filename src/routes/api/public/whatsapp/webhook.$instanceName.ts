import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsappWebhook } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute(
  "/api/public/whatsapp/webhook/$instanceName",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        handleWhatsappWebhook(request, params.instanceName),
      GET: async () => new Response("ok"),
    },
  },
});
