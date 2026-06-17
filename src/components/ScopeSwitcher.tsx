import { useAuth } from "@/lib/auth";
import { useScopeContext } from "@/lib/ScopeContext";
import { Building2, MapPin } from "lucide-react";

export function ScopeSwitcher() {
  const { role } = useAuth();
  const {
    clinicas,
    unidades,
    selectedClinicaId,
    selectedUnidadeId,
    setSelectedClinicaId,
    setSelectedUnidadeId,
    loading
  } = useScopeContext();

  // Recepcionistas não veem o seletor, ficam presas na unidade delas.
  if (role === "recepcao") return null;
  if (loading) return null;

  // Filtra as unidades para mostrar apenas as da clínica selecionada
  const unidadesDaClinica = unidades.filter((u) => u.clinica_id === selectedClinicaId);

  return (
    <div className="px-3 py-2 space-y-3 mb-2 border-b border-sidebar-border pb-4">
      {/* Seletor de Clínica/Rede (Só Agência pode mudar a clínica livremente, Gestor vê travado na dele) */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Building2 className="size-3" />
          Rede / Clínica
        </label>
        <select
          value={selectedClinicaId || ""}
          onChange={(e) => setSelectedClinicaId(e.target.value || null)}
          disabled={role !== "agencia"} // Somente agência muda a clínica pai
          className="w-full text-sm bg-background border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="" disabled>Selecione uma clínica...</option>
          {clinicas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Seletor de Unidade (Agência e Gestor podem mudar a unidade atual) */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <MapPin className="size-3" />
          Unidade Ativa
        </label>
        <select
          value={selectedUnidadeId || ""}
          onChange={(e) => setSelectedUnidadeId(e.target.value || null)}
          disabled={!selectedClinicaId || unidadesDaClinica.length === 0}
          className="w-full text-sm bg-background border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="" disabled>
            {unidadesDaClinica.length === 0 ? "Nenhuma unidade" : "Todas as unidades (Rede)"}
          </option>
          {/* Se a Agência/Gestor quiser ver dados agregados da rede toda, poderíamos deixar vazio, mas por ora vamos forçar escolha ou deixar a opção "Todas" */}
          {unidadesDaClinica.length > 1 && (
             <option value="">Visualização da Rede Inteira</option>
          )}
          {unidadesDaClinica.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
