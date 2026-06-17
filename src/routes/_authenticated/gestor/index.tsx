import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/gestor/")({
  beforeLoad: () => {
    throw redirect({
      to: "/gestor/relatorios",
    });
  },
});
