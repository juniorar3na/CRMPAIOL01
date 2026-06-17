import { createFileRoute } from "@tanstack/react-router";
import { ChatInterno } from "@/components/ChatInterno";

export const Route = createFileRoute("/_authenticated/gestor/chat-interno")({
  head: () => ({ meta: [{ title: "Chat Interno — Gestor" }] }),
  component: () => <ChatInterno />,
});
