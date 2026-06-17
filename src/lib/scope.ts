import { useScopeContext } from "./ScopeContext";
import type { DbUnidade } from "@/lib/db-types";

// Retorna as listas completas que o usuário tem acesso
export function useScope() {
  const { clinicas, unidades, loading } = useScopeContext();
  return { clinicas, unidades, loading };
}

export function unidadeNome(unidades: DbUnidade[], id: string | null | undefined): string {
  if (!id) return "—";
  return unidades.find((u) => u.id === id)?.nome ?? "—";
}

// Retorna a clínica/unidade ativa no seletor
export function useCurrentScope() {
  const { selectedClinicaId: clinicaId, selectedUnidadeId: unidadeId, loading } = useScopeContext();
  return { clinicaId, unidadeId, loading };
}

