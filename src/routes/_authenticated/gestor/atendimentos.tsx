import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Phone,
  PawPrint,
  Bot,
  Send,
  AlertTriangle,
  Tags,
  Pencil,
  Info,
  X,
  UserCheck,
  CheckCircle2,
  FileText,
  ClipboardList,
  ChevronDown,
  SlidersHorizontal,
  MessageSquare,
  Clock,
  Flame,
  CircleCheck,
  Timer,
  Paperclip,
  Smile,
  ArrowLeft,
  Mic,
  Square,
  Loader2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/AppShell";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  horaCurta,
  tempoRelativo,
  type DbConversa,
  type DbMensagem,
} from "@/lib/db-types";
import { useScope, useCurrentScope } from "@/lib/scope";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL || "http://127.0.0.1:3001";

export const Route = createFileRoute("/_authenticated/gestor/atendimentos")({
  head: () => ({ meta: [{ title: "Atendimentos — Gestor" }] }),
  component: GestorAtendimentos,
});

/* ─── Color maps ─── */

const statusColor: Record<string, string> = {
  "IA respondendo": "bg-emerald-100 text-emerald-800",
  "Aguardando humano": "bg-amber-100 text-amber-900",
  "Em atendimento": "bg-indigo-100 text-indigo-800",
  Finalizado: "bg-muted text-muted-foreground",
  "Retorno pendente": "bg-orange-100 text-orange-800",
  Perdido: "bg-rose-100 text-rose-700",
};

const prioridadeColor: Record<string, string> = {
  Baixa: "bg-muted text-muted-foreground",
  Normal: "bg-sky-100 text-sky-800",
  Alta: "bg-amber-100 text-amber-900",
  Urgente: "bg-rose-600 text-white",
};

/* ─── Tab type ─── */
type RightTab = "conversa" | "resumo" | "dados";

/* ─── Main component ─── */

export function GestorAtendimentos() {
  const [conversas, setConversas] = useState<DbConversa[]>([]);
  const [mensagens, setMensagens] = useState<DbMensagem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [resposta, setResposta] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("conversa");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  
  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { unidades } = useScope();
  const { clinicaId, unidadeId } = useCurrentScope();

  /* ─── Data loading ─── */

  async function carregarConversas() {
    let q = supabase
      .from("conversas")
      .select("*")
      .order("updated_at", { ascending: false });

    if (clinicaId) q = q.eq("clinica_id", clinicaId);
    if (unidadeId) q = q.eq("unidade_id", unidadeId);

    const { data } = await q;
    setConversas(data ?? []);
    setLoading(false);
    if (!selectedId && data && data.length > 0) setSelectedId(data[0].id);
  }

  useEffect(() => {
    carregarConversas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId, unidadeId]);

  useEffect(() => {
    if (!selectedId) {
      setMensagens([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("mensagens")
        .select("*")
        .eq("conversa_id", selectedId)
        .order("created_at");
      setMensagens(data ?? []);
    })();
  }, [selectedId]);

  /* ─── REALTIME ─── */
  useEffect(() => {
    if (loading) return;

    // Escutar novas mensagens em tempo real
    const msgSub = supabase
      .channel("mensagens-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens" },
        (payload) => {
          const newMsg = payload.new as DbMensagem;
          
          // Se for da conversa atualmente selecionada, adiciona na lista
          if (newMsg.conversa_id === selectedIdRef.current) {
             setMensagens((prev) => {
               if (prev.some((m) => m.id === newMsg.id)) return prev;
               return [...prev, newMsg];
             });
          }

          // Atualiza a data de modificação da conversa na barra lateral
          setConversas((prev) => 
            prev.map(c => c.id === newMsg.conversa_id ? { ...c, updated_at: newMsg.created_at } : c)
          );
        }
      )
      .subscribe();

    // Escutar mudanças de status das conversas em tempo real
    const convSub = supabase
      .channel("conversas-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversas" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setConversas((prev) =>
              prev.map((c) => (c.id === payload.new.id ? { ...c, ...(payload.new as DbConversa) } : c))
            );
          } else if (payload.eventType === "INSERT") {
            const newConv = payload.new as DbConversa;
            if ((!clinicaId || newConv.clinica_id === clinicaId) && (!unidadeId || newConv.unidade_id === unidadeId)) {
               setConversas((prev) => [newConv, ...prev]);
            }
          } else if (payload.eventType === "DELETE") {
             setConversas((prev) => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(convSub);
    };
  }, [clinicaId, unidadeId, loading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  /* ─── Derived state ─── */

  const selecionada = useMemo(
    () => conversas.find((c) => c.id === selectedId) ?? null,
    [conversas, selectedId],
  );

  const filtradas = conversas.filter(
    (c) =>
      c.tutor.toLowerCase().includes(busca.toLowerCase()) ||
      (c.pet ?? "").toLowerCase().includes(busca.toLowerCase()) ||
      (c.telefone ?? "").includes(busca) ||
      (c.motivo ?? "").toLowerCase().includes(busca.toLowerCase()),
  ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  /* ─── Metrics ─── */

  const metrics = useMemo(() => {
    const total = conversas.length;
    const aguardando = conversas.filter((c) => c.status === "Aguardando humano").length;
    const urgentes = conversas.filter((c) => c.prioridade === "Urgente").length;
    const finalizados = conversas.filter((c) => c.status === "Finalizado").length;
    return { total, aguardando, urgentes, finalizados };
  }, [conversas]);

  /* ─── Actions via Backend ─── */

  async function patchConversa(patch: Partial<DbConversa>) {
    if (!selecionada) return;
    const { error } = await supabase
      .from("conversas")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", selecionada.id);
    if (error) return toast.error(error.message);
  }

  async function assumirAtendimento() {
    if (!selecionada) return;
    setWorking(true);
    try {
      const res = await fetch(`${AI_BACKEND_URL}/chat/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversaId: selecionada.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Você assumiu o atendimento!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao assumir atendimento");
    } finally {
      setWorking(false);
    }
  }

  async function reativarIA() {
    if (!selecionada) return;
    setWorking(true);
    try {
      const res = await fetch(`${AI_BACKEND_URL}/chat/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversaId: selecionada.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("IA reativada para esta conversa!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao reativar IA");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteConversation() {
    if (!selecionada) return;
    if (!confirm("Tem certeza que deseja apagar esta conversa e todas as suas mensagens? Isso não pode ser desfeito.")) return;

    try {
      setWorking(true);
      // Apaga as mensagens primeiro caso não exista ON DELETE CASCADE
      await supabase.from("mensagens").delete().eq("conversa_id", selecionada.id);
      
      const { error } = await supabase.from("conversas").delete().eq("id", selecionada.id);
      if (error) throw error;
      
      // Remove instantaneamente da lista local sem depender do delay do Realtime
      setConversas((prev) => prev.filter(c => c.id !== selecionada.id));
      setSelectedId(null);
      toast.success("Conversa deletada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao deletar conversa");
    } finally {
      setWorking(false);
    }
  }

  async function enviarTexto() {
    if (!resposta.trim() || !selecionada) return;
    const texto = resposta.trim();
    setResposta("");
    setWorking(true);
    try {
      const res = await fetch(`${AI_BACKEND_URL}/chat/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversaId: selecionada.id, texto }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
    } finally {
      setWorking(false);
    }
  }

  /* ─── Audio Recording ─── */

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
           const base64data = reader.result;
           if (typeof base64data === 'string' && selecionada) {
              setWorking(true);
              try {
                const res = await fetch(`${AI_BACKEND_URL}/chat/send/audio`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ conversaId: selecionada.id, audioBase64: base64data }),
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
              } catch (err: any) {
                toast.error(err.message || "Erro ao enviar áudio");
              } finally {
                setWorking(false);
              }
           }
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao acessar o microfone. Verifique as permissões.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  /* ─── Document Upload ─── */

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
     const file = event.target.files?.[0];
     if (!file || !selecionada) return;
     if (file.size > 15 * 1024 * 1024) {
        toast.error("O arquivo não pode exceder 15MB");
        return;
     }

     const reader = new FileReader();
     reader.readAsDataURL(file);
     reader.onloadend = async () => {
        const base64data = reader.result;
        if (typeof base64data === 'string') {
           setWorking(true);
           try {
              const res = await fetch(`${AI_BACKEND_URL}/chat/send/document`, {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ conversaId: selecionada.id, documentBase64: base64data, fileName: file.name }),
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error);
           } catch (err: any) {
              toast.error(err.message || "Erro ao enviar documento");
           } finally {
              setWorking(false);
           }
        }
     }
     
     // clear input
     if (fileInputRef.current) {
         fileInputRef.current.value = "";
     }
  }

  /* ─── Helper ─── */

  function dataLabel(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    if (d.toDateString() === hoje.toDateString()) return "Hoje";
    if (d.toDateString() === ontem.toDateString()) return "Ontem";
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  }

  function nomeUnidade(uid: string) {
    return unidades.find((u) => u.id === uid)?.nome ?? "—";
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center justify-center h-screen">
        <Loader2 className="size-6 animate-spin mr-2" />
        Carregando atendimentos ao vivo…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh)] flex flex-col bg-background">
      {/* ─── Top bar: title + filters + metrics ─── */}
      <div className="shrink-0 border-b border-black/5 bg-background">
        <div className="px-8 pt-6 pb-2">
          <PageHeader
            title="Atendimentos"
            description="Acompanhe e responda a todos os atendimentos via WhatsApp em tempo real."
          />
        </div>

        {/* Metric cards row */}
        <div className="px-8 pb-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Total de atendimentos"
            value={metrics.total}
            icon={<MessageSquare className="size-4" />}
          />
          <MetricCard
            label="Aguardando humano"
            value={metrics.aguardando}
            tone={metrics.aguardando > 0 ? "warning" : "default"}
            icon={<Clock className="size-4" />}
          />
          <MetricCard
            label="Urgentes"
            value={metrics.urgentes}
            tone={metrics.urgentes > 0 ? "urgent" : "default"}
            icon={<Flame className="size-4" />}
          />
          <MetricCard
            label="Finalizados"
            value={metrics.finalizados}
            tone="success"
            icon={<CircleCheck className="size-4" />}
          />
          <MetricCard
            label="Tempo médio de resposta"
            value="2m 48s"
            icon={<Timer className="size-4" />}
          />
        </div>
      </div>

      {/* ─── Three‑column workspace ─── */}
      <div className="flex-1 min-h-0 grid grid-cols-12">
        {/* ── LEFT: Conversation list ── */}
        <aside className="col-span-3 border-r border-black/5 flex flex-col min-h-0 bg-background">
          {/* Search + filter */}
          <div className="p-4 border-b border-black/5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por tutor, telefone, pet..."
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
                <SlidersHorizontal className="size-3.5" />
                Filtros
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              <span>Tutor / Pet</span>
              <span className="w-16 text-center">Prioridade</span>
              <span className="w-24 text-center">Status</span>
              <span className="w-14 text-right">Horário</span>
            </div>
          </div>

          {/* Conversation rows */}
          <div className="flex-1 overflow-y-auto">
            {filtradas.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Nenhuma conversa encontrada.
              </p>
            )}
            {filtradas.map((c) => {
              const ativa = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  id={`atendimento-${c.id}`}
                  onClick={() => {
                    setSelectedId(c.id);
                    setActiveTab("conversa");
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-black/5 transition-colors ${
                    ativa
                      ? "bg-brand-surface/60"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    {/* Tutor + pet */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 uppercase">
                          {c.tutor.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{c.tutor}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.pet ?? "—"} · {c.especie ?? "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Motivo + Prioridade */}
                    <div className="flex items-center gap-1.5 w-auto">
                      {c.motivo && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[80px] hidden xl:inline">
                          {c.motivo}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase whitespace-nowrap ${
                          prioridadeColor[c.prioridade] ?? "bg-muted"
                        }`}
                      >
                        {c.prioridade}
                      </span>
                    </div>

                    {/* Status */}
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${
                        statusColor[c.status] ?? "bg-muted"
                      }`}
                    >
                      {c.status}
                    </span>

                    {/* Time */}
                    <span className="text-xs text-muted-foreground tabular-nums w-14 text-right whitespace-nowrap">
                      {dataLabel(c.updated_at)}{" "}
                      <span className="block text-[10px]">
                        {horaCurta(c.updated_at)}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── CENTER: Chat view ── */}
        <section className="col-span-5 flex flex-col min-h-0 bg-muted/20 relative">
          {working && (
             <div className="absolute top-0 left-0 right-0 h-1 bg-brand/20 overflow-hidden z-10">
                <div className="h-full bg-brand w-1/3 animate-pulse rounded-full" />
             </div>
          )}
          {!selecionada ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center space-y-2">
                <MessageSquare className="size-10 mx-auto opacity-30" />
                <p>Selecione uma conversa para visualizar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-black/5 bg-background flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden p-1 hover:bg-muted rounded-md"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <div className="size-10 rounded-full bg-brand-surface flex items-center justify-center text-sm font-bold text-brand shrink-0 uppercase">
                    {selecionada.tutor.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{selecionada.tutor}</h3>
                      <span className="text-brand">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                        </svg>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Phone className="size-3" />
                      {selecionada.telefone ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">Unidade</strong>{" "}
                    {nomeUnidade(selecionada.unidade_id)}
                  </span>
                  <span>
                    <strong className="text-foreground">Origem</strong>{" "}
                    <span className="inline-flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-3 text-brand">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                      </svg>
                      WhatsApp
                    </span>
                  </span>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex border-b border-black/5 bg-background">
                {(
                  [
                    ["conversa", "Conversa"],
                    ["resumo", "Resumo IA"],
                    ["dados", "Dados do Tutor"],
                  ] as [RightTab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === key
                        ? "border-brand text-brand"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === "conversa" && (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {mensagens.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-12">
                        Nenhuma mensagem nesta conversa.
                      </p>
                    )}

                    {/* Group messages by day */}
                    {(() => {
                      let lastDate = "";
                      return mensagens.map((m) => {
                        const msgDate = dataLabel(m.created_at);
                        const showDateHeader = msgDate !== lastDate;
                        lastDate = msgDate;
                        const isTutor = m.remetente === "tutor";
                        return (
                          <div key={m.id}>
                            {showDateHeader && (
                              <div className="flex items-center justify-center my-4">
                                <span className="px-3 py-1 bg-muted/60 text-muted-foreground text-[11px] font-medium rounded-full">
                                  {msgDate}, {format(new Date(m.created_at), "dd/MM/yyyy")}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isTutor ? "justify-start" : "justify-end"}`}>
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                  isTutor
                                    ? "bg-background border border-black/5 rounded-bl-sm"
                                    : m.remetente === "ia"
                                      ? "bg-brand text-brand-foreground rounded-br-sm"
                                      : "bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-br-sm"
                                }`}
                              >
                                <p className="leading-relaxed whitespace-pre-wrap">
                                  {m.conteudo}
                                </p>
                                <div
                                  className={`text-[10px] mt-1 flex items-center gap-1 ${
                                    isTutor ? "text-muted-foreground" : "opacity-70"
                                  } ${isTutor ? "justify-start" : "justify-end"}`}
                                >
                                  {horaCurta(m.created_at)}
                                  {!isTutor && (
                                    <svg viewBox="0 0 16 11" fill="currentColor" className="size-3.5 opacity-60">
                                      <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.046.247.14.337l2.996 2.996a.724.724 0 0 0 .501.203.697.697 0 0 0 .521-.229L11.218 1.2a.469.469 0 0 0 .14-.336.43.43 0 0 0-.133-.311l-.154-.1z"/>
                                      <path d="M14.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.134-.311.31 1.79 1.79a.724.724 0 0 0 .501.203.697.697 0 0 0 .521-.229L14.218 1.2a.469.469 0 0 0 .14-.336.43.43 0 0 0-.133-.311l-.154-.1z"/>
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Input bar */}
                  <div className="p-3 border-t border-black/5 bg-background">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                    <div className="flex items-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 shrink-0 text-muted-foreground"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={working}
                      >
                        <Paperclip className="size-4" />
                      </Button>
                      
                      {!isRecording ? (
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-10 w-10 shrink-0 text-muted-foreground hover:text-red-500"
                           onClick={startRecording}
                           disabled={working}
                         >
                           <Mic className="size-4" />
                         </Button>
                      ) : (
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-10 w-10 shrink-0 text-red-500 animate-pulse bg-red-50"
                           onClick={stopRecording}
                         >
                           <Square className="size-4" fill="currentColor" />
                         </Button>
                      )}
                      
                      <Textarea
                        value={resposta}
                        onChange={(e) => setResposta(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            enviarTexto();
                          }
                        }}
                        placeholder={isRecording ? "Gravando áudio..." : "Digite sua resposta..."}
                        className="min-h-[44px] max-h-[120px] resize-none text-sm"
                        disabled={isRecording || working}
                      />
                      <Button
                        onClick={enviarTexto}
                        size="icon"
                        disabled={!resposta.trim() || working || isRecording}
                        className="h-10 w-10 shrink-0 rounded-full bg-brand hover:bg-brand/90"
                      >
                        <Send className="size-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "resumo" && selecionada && (
                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">


                  {selecionada.resumo_ia && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                        Resumo
                      </p>
                      <p className="text-sm leading-relaxed bg-brand-surface p-3 rounded-lg">
                        {selecionada.resumo_ia}
                      </p>
                    </div>
                  )}

                </div>
              )}

              {activeTab === "dados" && selecionada && (
                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
                  <ResumoItem label="Nome do tutor" value={selecionada.tutor} />
                  <ResumoItem label="Telefone" value={selecionada.telefone ?? "—"} />
                  <ResumoItem label="CPF" value={selecionada.cpf ?? "—"} />
                  <ResumoItem label="Pet" value={selecionada.pet ?? "—"} />
                  <ResumoItem label="Espécie" value={selecionada.especie ?? "—"} />
                  <ResumoItem label="Raça" value={selecionada.raca ?? "—"} />
                  <ResumoItem label="Idade" value={selecionada.idade ?? "—"} />
                  <ResumoItem label="Unidade" value={nomeUnidade(selecionada.unidade_id)} />
                  <ResumoItem label="Origem" value={selecionada.origem} />

                  {selecionada.sintomas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                        Sintomas
                      </p>
                      <ul className="space-y-1">
                        {selecionada.sintomas.map((s, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="text-brand">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── RIGHT: Resumo IA ── */}
        <aside className="col-span-4 border-l border-black/5 flex flex-col min-h-0 bg-background">
          {!selecionada ? (
            <div className="flex-1 p-6 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center space-y-2">
                <Bot className="size-10 mx-auto opacity-30" />
                <p>Selecione uma conversa para ver os detalhes.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-black/5 flex items-center gap-2">
                <Info className="size-4 text-brand" />
                <h3 className="font-semibold">Informações do Atendimento</h3>
              </div>

              <div className="flex-1 overflow-y-auto">
                <Accordion type="multiple" defaultValue={["resumo", "dados"]} className="w-full">
                  <AccordionItem value="resumo" className="border-b border-black/5 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <Bot className="size-4 text-brand" />
                        Resumo IA
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {selecionada.resumo_ia ? (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                            Resumo
                          </p>
                          <p className="text-sm leading-relaxed bg-brand-surface p-3 rounded-lg">
                            {selecionada.resumo_ia}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem resumo disponível.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="dados" className="border-b-0 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <UserCheck className="size-4 text-brand" />
                        Dados do Tutor
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <EditTutorModal 
                          conversa={selecionada} 
                          onSuccess={(updates) => {
                            setConversas(prev => prev.map(c => c.id === selecionada.id ? { ...c, ...updates } : c));
                          }} 
                        />
                        <EditTagsModal 
                          conversa={selecionada} 
                          onSuccess={(etiquetas) => {
                            setConversas(prev => prev.map(c => c.id === selecionada.id ? { ...c, etiquetas } : c));
                          }} 
                        />
                      </div>

                      {selecionada.etiquetas && selecionada.etiquetas.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pb-2">
                          {selecionada.etiquetas.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] uppercase font-bold">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <ResumoItem label="Nome do tutor" value={selecionada.tutor} />
                      <ResumoItem label="Telefone" value={selecionada.telefone ?? "—"} />
                      <ResumoItem label="CPF" value={selecionada.cpf ?? "—"} />
                      <ResumoItem label="Pet" value={selecionada.pet ?? "—"} />
                      <ResumoItem
                        label="Espécie / Raça"
                        value={`${selecionada.especie ?? "—"} / ${selecionada.raca ?? "—"}`}
                      />
                      <ResumoItem label="Idade" value={selecionada.idade ?? "—"} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Action buttons */}
              <div className="p-3 border-t border-black/5 space-y-2 bg-muted/10">
                {selecionada.status === "Em atendimento" ? (
                  <Button
                    onClick={reativarIA}
                    disabled={working}
                    className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Bot className="size-4 mr-1.5" />
                    Reativar IA
                  </Button>
                ) : (
                  <Button
                    onClick={assumirAtendimento}
                    disabled={working}
                    className="w-full h-11 font-semibold"
                  >
                    <UserCheck className="size-4 mr-1.5" />
                    Assumir atendimento
                  </Button>
                )}

                {selecionada.prioridade?.toUpperCase() === "URGENTE" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      patchConversa({ prioridade: "Normal" });
                      toast.success("Urgência removida");
                    }}
                    className="w-full h-10 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <AlertTriangle className="size-4 mr-1.5 opacity-50" />
                    Remover urgência
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      patchConversa({ prioridade: "Urgente" });
                      toast.warning("Marcado como urgente");
                    }}
                    className="w-full h-10 border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-1.5" />
                    Marcar como urgente
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => toast("Solicitação de CPF enviada")}
                  className="w-full h-10"
                >
                  <ClipboardList className="size-4 mr-1.5" />
                  Solicitar CPF
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDeleteConversation}
                  disabled={working}
                  className="w-full h-10 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4 mr-1.5" />
                  Deletar conversa
                </Button>

                <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1">
                  Mais ações
                  <ChevronDown className="size-3" />
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ─── Subcomponent ─── */

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function EditTutorModal({
  conversa,
  onSuccess,
}: {
  conversa: DbConversa;
  onSuccess: (data: Partial<DbConversa>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tutor: conversa.tutor,
    telefone: conversa.telefone ?? "",
    cpf: conversa.cpf ?? "",
    pet: conversa.pet ?? "",
    especie: conversa.especie ?? "",
    raca: conversa.raca ?? "",
    idade: conversa.idade ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("conversas")
        .update(formData)
        .eq("id", conversa.id);
      
      if (error) throw error;
      toast.success("Dados atualizados com sucesso!");
      onSuccess(formData);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar dados");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 flex-1">
          <Pencil className="size-3" />
          Editar Dados
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Dados do Tutor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Nome</label>
              <Input
                value={formData.tutor}
                onChange={(e) => setFormData({ ...formData, tutor: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Telefone</label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">CPF</label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Pet</label>
              <Input
                value={formData.pet}
                onChange={(e) => setFormData({ ...formData, pet: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Espécie</label>
              <Input
                value={formData.especie}
                onChange={(e) => setFormData({ ...formData, especie: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Raça</label>
              <Input
                value={formData.raca}
                onChange={(e) => setFormData({ ...formData, raca: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Idade</label>
              <Input
                value={formData.idade}
                onChange={(e) => setFormData({ ...formData, idade: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTagsModal({
  conversa,
  onSuccess,
}: {
  conversa: DbConversa;
  onSuccess: (etiquetas: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [etiquetas, setEtiquetas] = useState<string[]>(conversa.etiquetas || []);
  const [novaTag, setNovaTag] = useState("");

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!novaTag.trim()) return;
    const t = novaTag.trim();
    if (etiquetas.includes(t)) {
      setNovaTag("");
      return;
    }
    
    const newTags = [...etiquetas, t];
    setEtiquetas(newTags);
    setNovaTag("");
    await saveTags(newTags);
  }

  async function handleRemoveTag(t: string) {
    const newTags = etiquetas.filter(tag => tag !== t);
    setEtiquetas(newTags);
    await saveTags(newTags);
  }

  async function saveTags(tags: string[]) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("conversas")
        .update({ etiquetas: tags })
        .eq("id", conversa.id);
      
      if (error) throw error;
      onSuccess(tags);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar etiquetas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
       setOpen(val);
       if (val) setEtiquetas(conversa.etiquetas || []);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 flex-1">
          <Tags className="size-3" />
          Etiquetas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Etiquetas do Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <form onSubmit={handleAddTag} className="flex gap-2">
            <Input 
              placeholder="Nova etiqueta... (ex: Retorno, Cliente VIP)" 
              value={novaTag}
              onChange={(e) => setNovaTag(e.target.value)}
            />
            <Button type="submit" disabled={!novaTag.trim() || loading}>
              Adicionar
            </Button>
          </form>
          
          <div className="flex flex-wrap gap-2">
            {etiquetas.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 w-full text-center">Nenhuma etiqueta adicionada.</p>
            )}
            {etiquetas.map(t => (
              <Badge key={t} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                {t}
                <button 
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                  disabled={loading}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
