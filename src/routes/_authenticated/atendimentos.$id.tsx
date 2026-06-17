import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Phone,
  IdCard,
  PawPrint,
  MapPin,
  AlertTriangle,
  Bot,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  horaCurta,
  tempoRelativo,
  type DbConversa,
  type DbMensagem,
  type DbUnidade,
} from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/atendimentos/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Atendimento — ${params.id.slice(0, 8)}` }],
  }),
  notFoundComponent: () => (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Atendimento não encontrado</h1>
      <p className="text-muted-foreground mb-6">Esse caso pode ter sido removido.</p>
      <Link to="/gestor">
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </Link>
    </div>
  ),
  component: AtendimentoDetalhe,
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

function AtendimentoDetalhe() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [a, setA] = useState<DbConversa | null>(null);
  const [unidade, setUnidade] = useState<DbUnidade | null>(null);
  const [mensagens, setMensagens] = useState<DbMensagem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: conv } = await supabase
        .from("conversas")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!conv) {
        setLoading(false);
        throw notFound();
      }
      setA(conv);
      const [{ data: msgs }, { data: u }] = await Promise.all([
        supabase
          .from("mensagens")
          .select("*")
          .eq("conversa_id", id)
          .order("created_at"),
        supabase.from("unidades").select("*").eq("id", conv.unidade_id).maybeSingle(),
      ]);
      setMensagens(msgs ?? []);
      setUnidade(u ?? null);
      setLoading(false);
    })();
  }, [id]);

  async function marcarUrgente() {
    if (!a) return;
    const { error } = await supabase
      .from("conversas")
      .update({ prioridade: "Urgente" })
      .eq("id", a.id);
    if (!error) {
      setA({ ...a, prioridade: "Urgente" });
      router.invalidate();
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!a) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          to="/gestor"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar ao painel
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {a.tutor} · {a.pet ?? "—"}
            </h1>
            <p className="text-muted-foreground mt-1">{a.motivo ?? "—"}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className={statusBadge[a.status]}>{a.status}</Badge>
              <Badge variant="outline" className={prioridadeBadge[a.prioridade]}>{a.prioridade}</Badge>
              {unidade && (
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                  <MapPin className="h-3 w-3 mr-1" /> {unidade.nome}
                </Badge>
              )}
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                Atualizado: {tempoRelativo(a.updated_at)}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/recepcao">
              <Button>Abrir na recepção</Button>
            </Link>
            <Button variant="outline" onClick={marcarUrgente}>
              <AlertTriangle className="h-4 w-4 mr-1.5 text-urgent" /> Marcar urgente
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-card rounded-xl ring-1 ring-black/5 p-5">
          <h2 className="text-lg font-semibold mb-4">Histórico da conversa</h2>
          <div className="space-y-3">
            {mensagens.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada.</p>
            )}
            {mensagens.map((m) => {
              const eh = m.remetente === "tutor" ? "left" : "right";
              return (
                <div key={m.id} className={`flex ${eh === "left" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      eh === "left"
                        ? "bg-muted text-foreground rounded-bl-sm"
                        : m.remetente === "ia"
                        ? "bg-brand text-brand-foreground rounded-br-sm"
                        : "bg-foreground text-background rounded-br-sm"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5 flex items-center gap-1">
                      {m.remetente === "tutor" ? (
                        <PawPrint className="h-3 w-3" />
                      ) : m.remetente === "ia" ? (
                        <Bot className="h-3 w-3" />
                      ) : (
                        <UserCheck className="h-3 w-3" />
                      )}
                      {m.remetente === "tutor" ? "Tutor" : m.remetente === "ia" ? "IA" : "Recepção"}
                    </div>
                    {m.conteudo}
                    <div className="text-[10px] opacity-60 mt-1 text-right">
                      {horaCurta(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="bg-card rounded-xl ring-1 ring-black/5 p-5 space-y-4 h-fit">
          <h2 className="text-lg font-semibold">Resumo do caso</h2>

          <Info label="Tutor" value={a.tutor} />
          <Info label="Telefone" value={a.telefone ?? "—"} icon={<Phone className="h-3.5 w-3.5" />} />
          {a.cpf && <Info label="CPF" value={a.cpf} icon={<IdCard className="h-3.5 w-3.5" />} />}
          <Info
            label="Pet"
            value={`${a.pet ?? "—"} · ${a.especie ?? "—"}`}
            icon={<PawPrint className="h-3.5 w-3.5" />}
          />
          <Info label="Motivo" value={a.motivo ?? "—"} />

          {a.sintomas.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Sintomas
              </div>
              <ul className="text-sm space-y-1">
                {a.sintomas.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-urgent mt-1">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {a.servico_recomendado && (
            <Info label="Serviço recomendado" value={a.servico_recomendado} />
          )}
          {a.proxima_acao && <Info label="Próxima ação" value={a.proxima_acao} />}

          {a.resumo_ia && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Resumo
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{a.resumo_ia}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
