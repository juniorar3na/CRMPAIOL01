import { createFileRoute } from "@tanstack/react-router";
import { GestorAtendimentos } from "../gestor/atendimentos";

export const Route = createFileRoute("/_authenticated/recepcao/")({
  head: () => ({ meta: [{ title: "Atendimentos — Recepção" }] }),
  component: RecepcaoAtendimentosPage,
});

function RecepcaoAtendimentosPage() {
  return <GestorAtendimentos />;
}
