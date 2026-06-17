import { createFileRoute } from "@tanstack/react-router";
import { ChatInterno } from "@/components/ChatInterno";

export const Route = createFileRoute("/_authenticated/recepcao/chat-interno")({
  head: () => ({ meta: [{ title: "Chat Interno — Recepção" }] }),
  component: () => <ChatInterno />,
});
