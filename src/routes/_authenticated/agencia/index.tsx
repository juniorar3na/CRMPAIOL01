import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Stethoscope,
  FlaskConical,
  Clock,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScope, useCurrentScope } from "@/lib/scope";
import { tempoRelativo, type DbConversa } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/agencia/")({
  head: () => ({ meta: [{ title: "Dashboard — Agência" }] }),
  component: AgenciaDashboard,
});

const prioridadeBadge: Record<string, string> = {
  Urgente: "bg-urgent/15 text-urgent border-urgent/30",
  Alta: "bg-warning/15 text-foreground border-warning/40",
  Normal: "bg-muted text-foreground border-border",
  Baixa: "bg-muted/60 text-muted-foreground border-border",
};

const statusBadge: Record<string, string> = {
  "Aguardando humano": "bg-warning/15 text-foreground border-warning/40",
  "Em atendimento": "bg-brand-surface text-brand border-brand/20",
  "IA respondendo": "bg-muted text-muted-foreground border-border",
  Finalizado: "bg-brand/10 text-brand border-brand/20",
};

function AgenciaDashboard() {
  const { clinicas, unidades } = useScope();
  const { clinicaId, unidadeId } = useCurrentScope();
  const [conversas, setConversas] = useState<DbConversa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("conversas")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (clinicaId) q = q.eq("clinica_id", clinicaId);
      if (unidadeId) q = q.eq("unidade_id", unidadeId);

      const { data } = await q;
      setConversas(data ?? []);
      setLoading(false);
    })();
  }, [clinicaId, unidadeId]);

  const metrics = useMemo(() => {
    const urg = conversas.filter((c) => c.prioridade === "Urgente").length;
    const aguard = conversas.filter((c) => c.status === "Aguardando humano").length;
    const internacoes = conversas.filter((c) => /interna/i.test(c.motivo ?? "")).length;
    const exames = conversas.filter((c) => /exame/i.test(c.motivo ?? "")).length;
    const leads = conversas.filter((c) => /agendar|orçamento|consulta|vacina/i.test(c.motivo ?? "")).length;
    const paradas = conversas.filter((c) => {
      if (c.status !== "Aguardando humano") return false;
      return Date.now() - new Date(c.updated_at).getTime() > 10 * 60_000;
    }).length;
    return { urg, aguard, internacoes, exames, leads, paradas };
  }, [conversas]);

  const porUnidade = useMemo(() => {
    return unidades
      .map((u) => {
        const cs = conversas.filter((c) => c.unidade_id === u.id);
        return {
          nome: u.nome,
          atendimentos: cs.length,
          urgencias: cs.filter((c) => c.prioridade === "Urgente").length,
        };
      })
      .filter((u) => u.atendimentos > 0)
      .sort((a, b) => b.atendimentos - a.atendimentos)
      .slice(0, 6);
  }, [conversas, unidades]);

  const porMotivo = useMemo(() => {
    const tipos: Record<string, RegExp> = {
      Consulta: /consulta/i,
      Vacina: /vacina/i,
      Exame: /exame/i,
      Internação: /interna/i,
      Emergência: /emerg|urg|sangue|vômit/i,
      Orçamento: /orçament|preço|valor|castra/i,
    };
    return Object.entries(tipos).map(([tipo, re]) => ({
      tipo,
      valor: conversas.filter((c) => re.test(c.motivo ?? "")).length,
    }));
  }, [conversas]);

  const ALERTAS = [
    { label: "Urgências aguardando recepção", valor: metrics.urg, icon: AlertTriangle, tone: "urgent" as const },
    { label: "Solicitações de internação", valor: metrics.internacoes, icon: Stethoscope, tone: "warning" as const },
    { label: "Pedidos de exame", valor: metrics.exames, icon: FlaskConical, tone: "warning" as const },
    { label: "Conversas paradas > 10 min", valor: metrics.paradas, icon: Clock, tone: "urgent" as const },
  ];

  const maxTipo = Math.max(1, ...porMotivo.map((t) => t.valor));
  const maxUnidade = Math.max(1, ...porUnidade.map((u) => u.atendimentos));

  const recentes = conversas.slice(0, 10);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando dados…</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Painel da agência"
        description="Visão consolidada de todas as clínicas, unidades e atendimentos da operação."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Clínicas cadastradas" value={clinicas.length} tone="success" />
        <MetricCard label="Unidades ativas" value={unidades.length} />
        <MetricCard label="Atendimentos totais" value={conversas.length} />
        <MetricCard label="Urgências" value={metrics.urg} tone="urgent" />
        <MetricCard label="Aguardando humano" value={metrics.aguard} tone="warning" />
        <MetricCard label="Leads captados" value={metrics.leads} tone="success" />
        <MetricCard label="Pedidos de internação" value={metrics.internacoes} />
        <MetricCard label="Pedidos de exame" value={metrics.exames} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Alertas importantes</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ALERTAS.map((a) => {
            const Icon = a.icon;
            const cls =
              a.tone === "urgent"
                ? "bg-urgent-surface ring-urgent/30 text-urgent"
                : "bg-warning-surface ring-warning/30 text-foreground";
            return (
              <div key={a.label} className={`p-4 rounded-xl ring-1 flex items-center gap-3 ${cls}`}>
                <div className="p-2 rounded-lg bg-background/60">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-semibold leading-none">{a.valor}</div>
                  <div className="text-xs text-muted-foreground mt-1">{a.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-card rounded-xl ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Atendimentos recentes</h2>
            <span className="text-xs text-muted-foreground">Atualizado agora</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Tempo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.tutor}</TableCell>
                  <TableCell>{a.pet ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {unidades.find((u) => u.id === a.unidade_id)?.nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.motivo ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadge[a.status]}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={prioridadeBadge[a.prioridade]}>
                      {a.prioridade}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{tempoRelativo(a.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="bg-card rounded-xl ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Unidades com maior demanda</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          {porUnidade.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-3">
              {porUnidade.map((u) => (
                <li key={u.nome}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{u.nome}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {u.atendimentos} atend. · {u.urgencias} urg.
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${(u.atendimentos / maxUnidade) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-card rounded-xl ring-1 ring-black/5 p-5">
        <h2 className="text-lg font-semibold mb-4">Atendimentos por tipo</h2>
        <div className="grid grid-cols-6 gap-4 items-end h-56">
          {porMotivo.map((t) => (
            <div key={t.tipo} className="flex flex-col items-center justify-end h-full gap-2">
              <span className="text-sm font-semibold tabular-nums">{t.valor}</span>
              <div
                className="w-full bg-brand/80 rounded-t-md transition-all"
                style={{ height: `${(t.valor / maxTipo) * 100}%`, minHeight: 8 }}
              />
              <span className="text-xs text-muted-foreground">{t.tipo}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
