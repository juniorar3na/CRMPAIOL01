import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import type { DbClinica, DbUnidade } from "./db-types";

type ScopeContextType = {
  clinicas: DbClinica[];
  unidades: DbUnidade[];
  selectedClinicaId: string | null;
  selectedUnidadeId: string | null;
  setSelectedClinicaId: (id: string | null) => void;
  setSelectedUnidadeId: (id: string | null) => void;
  loading: boolean;
};

const ScopeContext = createContext<ScopeContextType | undefined>(undefined);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [clinicas, setClinicas] = useState<DbClinica[]>([]);
  const [unidades, setUnidades] = useState<DbUnidade[]>([]);
  
  const [selectedClinicaId, setSelectedClinicaId] = useState<string | null>(null);
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega as opções disponíveis e define os valores iniciais
  useEffect(() => {
    if (!user || !role) {
      setLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      
      // Buscar clinicas e unidades baseadas no RLS (que já filtra por role/user_roles)
      const [{ data: cData }, { data: uData }] = await Promise.all([
        supabase.from("clinicas").select("*").order("nome"),
        supabase.from("unidades").select("*").order("nome"),
      ]);

      if (!alive) return;

      const fetchedClinicas = cData ?? [];
      const fetchedUnidades = uData ?? [];

      setClinicas(fetchedClinicas);
      setUnidades(fetchedUnidades);

      // Descobrir as permissões específicas do banco
      const { data: userRoleData } = await supabase
        .from("user_roles")
        .select("clinica_id, unidade_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const userClinicaId = userRoleData?.clinica_id ?? null;
      const userUnidadeId = userRoleData?.unidade_id ?? null;

      if (role === "agencia") {
        // Agência vê tudo. Seleciona a primeira clínica e a primeira unidade dela por padrão.
        const defaultClinica = fetchedClinicas.length > 0 ? fetchedClinicas[0].id : null;
        setSelectedClinicaId(defaultClinica);
        if (defaultClinica) {
          const firstUnidade = fetchedUnidades.find(u => u.clinica_id === defaultClinica);
          setSelectedUnidadeId(firstUnidade ? firstUnidade.id : null);
        } else {
          setSelectedUnidadeId(null);
        }
      } else if (role === "gestor") {
        // Gestor fica travado na clínica dele, mas pode escolher unidades.
        setSelectedClinicaId(userClinicaId);
        // Se houver uma unidade específica ligada a ele, usa. Senão, pega a primeira unidade da rede.
        if (userUnidadeId) {
          setSelectedUnidadeId(userUnidadeId);
        } else if (userClinicaId) {
          const firstUnidade = fetchedUnidades.find(u => u.clinica_id === userClinicaId);
          setSelectedUnidadeId(firstUnidade ? firstUnidade.id : null);
        } else {
          setSelectedUnidadeId(null);
        }
      } else if (role === "recepcao") {
        // Recepção travada na clínica e unidade fixas
        setSelectedClinicaId(userClinicaId);
        setSelectedUnidadeId(userUnidadeId);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [user, role]);

  // Se a clínica mudar, tenta selecionar uma unidade válida daquela clínica
  const handleSetClinicaId = (newClinicaId: string | null) => {
    setSelectedClinicaId(newClinicaId);
    if (newClinicaId && newClinicaId !== "all") {
      const isCurrentUnidadeValid = unidades.some(u => u.id === selectedUnidadeId && u.clinica_id === newClinicaId);
      if (!isCurrentUnidadeValid) {
        const firstUnidade = unidades.find(u => u.clinica_id === newClinicaId);
        setSelectedUnidadeId(firstUnidade ? firstUnidade.id : null);
      }
    } else {
      setSelectedUnidadeId(null);
    }
  };

  const value = {
    clinicas,
    unidades,
    selectedClinicaId,
    selectedUnidadeId,
    setSelectedClinicaId: handleSetClinicaId,
    setSelectedUnidadeId,
    loading
  };

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScopeContext() {
  const context = useContext(ScopeContext);
  if (context === undefined) {
    throw new Error("useScopeContext must be used within a ScopeProvider");
  }
  return context;
}
