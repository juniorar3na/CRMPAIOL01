import { useAuth } from "@/lib/auth";
import { useScopeContext } from "@/lib/ScopeContext";

export function PageScopeFilter({ allowAllClinicas = false }: { allowAllClinicas?: boolean }) {
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

  if (role === "recepcao") return null;
  if (loading) return null;

  const unidadesDaClinica = unidades.filter((u) => u.clinica_id === selectedClinicaId);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 space-y-1.5 max-w-sm">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Clínica
        </label>
        <select
          value={selectedClinicaId || ""}
          onChange={(e) => setSelectedClinicaId(e.target.value || null)}
          disabled={role !== "agencia"}
          className="w-full text-sm bg-white border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <option value="" disabled={allowAllClinicas && role === "agencia"}>
            Selecione uma clínica...
          </option>
          {allowAllClinicas && role === "agencia" && (
            <option value="all">Todas as clínicas (Relatório Geral)</option>
          )}
          {clinicas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 space-y-1.5 max-w-sm">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Unidade
        </label>
        <select
          value={selectedUnidadeId || ""}
          onChange={(e) => setSelectedUnidadeId(e.target.value || null)}
          disabled={!selectedClinicaId || unidadesDaClinica.length === 0}
          className="w-full text-sm bg-white border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <option value="" disabled>
            {unidadesDaClinica.length === 0 ? "Nenhuma unidade" : "Selecione uma unidade..."}
          </option>
          {unidadesDaClinica.length > 1 && (
             <option value="">Todas as unidades (Rede)</option>
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
