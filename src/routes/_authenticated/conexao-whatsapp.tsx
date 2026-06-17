import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  QrCode,
  RefreshCw,
  LogOut,
  PlugZap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Smartphone,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/AppShell";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useScope, useCurrentScope } from "@/lib/scope";
import { useAuth } from "@/lib/auth";

// URL do servidor backend de IA (ajuste conforme ambiente)
const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL || "http://127.0.0.1:3001";
import {
  wuzapiCreateInstance,
  wuzapiDisconnect,
  wuzapiFetchQr,
  wuzapiFetchStatus,
  wuzapiRestart,
  wuzapiGenerateQr,
  wuzapiDeleteInstance,
  wuzapiFetchProfilePicture,
} from "@/lib/whatsapp.functions";
import { updateIaSettingsFn } from "@/lib/ia.functions";
import { Bot, Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/conexao-whatsapp")({
  head: () => ({ meta: [{ title: "Conexão WhatsApp" }] }),
  component: ConexaoWhatsAppPage,
});

type SessaoStatus =
  | "desconectado"
  | "aguardando_qr"
  | "conectado"
  | "reconectando"
  | "erro";

type WhatsAppSessao = {
  id: string;
  clinica_id: string;
  unidade_id: string;
  instance_name: string;
  status: SessaoStatus;
  numero_conectado: string | null;
  qr_code: string | null;
  connected_at: string | null;
  last_seen_at: string | null;
  api_token: string | null;
  webhook_secret: string | null;
  ia_ativa: boolean;
  ia_prompt: string | null;
  updated_at: string;
};

const STATUS_LABEL: Record<SessaoStatus, string> = {
  desconectado: "Desconectado",
  aguardando_qr: "Aguardando leitura do QR Code",
  conectado: "Conectado",
  reconectando: "Reconectando",
  erro: "Erro de conexão",
};

const STATUS_STYLE: Record<SessaoStatus, string> = {
  desconectado: "bg-muted text-muted-foreground border-black/10",
  aguardando_qr: "bg-amber-100 text-amber-900 border-amber-200",
  conectado: "bg-emerald-100 text-emerald-900 border-emerald-200",
  reconectando: "bg-sky-100 text-sky-900 border-sky-200",
  erro: "bg-rose-100 text-rose-900 border-rose-200",
};

function StatusBadge({ status }: { status: SessaoStatus }) {
  const Icon =
    status === "conectado"
      ? CheckCircle2
      : status === "erro"
      ? AlertTriangle
      : status === "reconectando" || status === "aguardando_qr"
      ? Loader2
      : PlugZap;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${STATUS_STYLE[status]}`}
    >
      <Icon
        className={`size-3.5 ${
          status === "reconectando" || status === "aguardando_qr" ? "animate-spin" : ""
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function MockQrCode({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const size = 25;
    const arr: boolean[] = [];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    for (let i = 0; i < size * size; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      arr.push((h & 1) === 1);
    }
    const mark = (cx: number, cy: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const on =
            x === 0 ||
            y === 0 ||
            x === 6 ||
            y === 6 ||
            (x >= 2 && x <= 4 && y >= 2 && y <= 4);
          arr[(cy + y) * size + (cx + x)] = on;
        }
      }
    };
    mark(0, 0);
    mark(size - 7, 0);
    mark(0, size - 7);
    return { cells: arr, size };
  }, [seed]);

  return (
    <div className="bg-white p-4 rounded-xl border border-black/10 shadow-sm inline-block">
      <div
        className="grid gap-0"
        style={{ gridTemplateColumns: `repeat(${cells.size}, 1fr)`, width: 256, height: 256 }}
      >
        {cells.cells.map((on, i) => (
          <div key={i} className={on ? "bg-black" : "bg-white"} />
        ))}
      </div>
    </div>
  );
}

function ConexaoWhatsAppPage() {
  const { role } = useAuth();
  const { clinicas, unidades, loading: scopeLoading } = useScope();
  const currentScope = useCurrentScope();
  const [clinicaId, setClinicaId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("");

  useEffect(() => {
    if (role === "recepcao" && currentScope.clinicaId && currentScope.unidadeId) {
      setClinicaId(currentScope.clinicaId);
      setUnidadeId(currentScope.unidadeId);
    }
  }, [role, currentScope.clinicaId, currentScope.unidadeId]);
  const [sessao, setSessao] = useState<WhatsAppSessao | null>(null);
  const [loadingSessao, setLoadingSessao] = useState(false);
  const [working, setWorking] = useState(false);

  // Novos states para o fluxo da Wuzapi
  const [inputInstanceName, setInputInstanceName] = useState("");
  const [inputPhoneNumber, setInputPhoneNumber] = useState("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // States IA
  const [iaAtiva, setIaAtiva] = useState(false);
  const [iaPrompt, setIaPrompt] = useState("");

  const createInstanceFn = useServerFn(wuzapiCreateInstance);
  const generateQrFn = useServerFn(wuzapiGenerateQr);
  const fetchStatusFn = useServerFn(wuzapiFetchStatus);
  const fetchQrFn = useServerFn(wuzapiFetchQr);
  const disconnectFn = useServerFn(wuzapiDisconnect);
  const restartFn = useServerFn(wuzapiRestart);
  const deleteInstanceFn = useServerFn(wuzapiDeleteInstance);
  const fetchProfilePictureFn = useServerFn(wuzapiFetchProfilePicture);
  const updateIaSettings = useServerFn(updateIaSettingsFn);
  const pollRef = useRef<{ stop: boolean } | null>(null);

  const unidadesFiltradas = unidades.filter(
    (u) => !clinicaId || u.clinica_id === clinicaId,
  );
  const unidade = unidades.find((u) => u.id === unidadeId);
  const clinica = clinicas.find((c) => c.id === clinicaId);

  useEffect(() => {
    if (role === "recepcao") return;
    if (!clinicaId && clinicas[0]) setClinicaId(clinicas[0].id);
  }, [clinicas, clinicaId, role]);
  
  useEffect(() => {
    if (role === "recepcao") return;
    if (clinicaId && (!unidade || unidade.clinica_id !== clinicaId)) {
      setUnidadeId(unidadesFiltradas[0]?.id ?? "");
    }
  }, [clinicaId, role, unidade, unidadesFiltradas]);

  useEffect(() => {
    if (!unidadeId) {
      setSessao(null);
      return;
    }
    let alive = true;
    setLoadingSessao(true);
    (async () => {
      let query = (supabase as unknown as { from: (t: string) => any })
        .from("whatsapp_sessoes")
        .select("*");
        
      if (unidadeId === "agencia-principal") {
        query = query.is("unidade_id", null);
      } else {
        query = query.eq("unidade_id", unidadeId);
      }
        
      const { data } = await query.maybeSingle();
      if (!alive) return;
      setSessao((data as WhatsAppSessao | null) ?? null);
      if (data) {
        setIaAtiva(data.ia_ativa ?? false);
        setIaPrompt(data.ia_prompt ?? "");
        setIaAtiva(data.ia_ativa ?? false);
        setIaPrompt(data.ia_prompt ?? "");
      }
      setLoadingSessao(false);
      // Pre-fill inputs se não existir sessão
      if (!data) {
        let slug = "agencia";
        let defaultPhone = "";
        if (unidadeId !== "agencia-principal") {
          slug = (unidades.find(u => u.id === unidadeId)?.nome ?? "unidade")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
          defaultPhone = unidades.find(u => u.id === unidadeId)?.whatsapp ?? "";
        }
        setInputInstanceName(`unid-${slug}`);
        setInputPhoneNumber(defaultPhone);
      }
    })();
    return () => {
      alive = false;
    };
  }, [unidadeId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) pollRef.current.stop = true;
    };
  }, [unidadeId]);

  useEffect(() => {
    if (sessao?.status === "conectado" && sessao.numero_conectado && sessao.api_token) {
      fetchProfilePictureFn({
        data: { apiToken: sessao.api_token, phoneNumber: sessao.numero_conectado },
      }).then(res => {
        if (res.url) setProfilePictureUrl(res.url);
      }).catch(console.warn);
    } else {
      setProfilePictureUrl(null);
    }
  }, [sessao?.status, sessao?.numero_conectado, sessao?.api_token]);

  function stopPolling() {
    if (pollRef.current) pollRef.current.stop = true;
    pollRef.current = null;
  }

  async function handleSaveIaSettings() {
    if (!sessao) return;
    setWorking(true);
    try {
      await updateIaSettings({ data: { sessaoId: sessao.id, iaAtiva, iaPrompt } });
      toast.success(iaAtiva ? 'IA ativada com sucesso!' : 'IA desativada com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar configuracoes da IA');
    } finally {
      setWorking(false);
    }
  }

  async function startQrPolling(apiToken: string) {
    stopPolling();
    const token = { stop: false };
    pollRef.current = token;
    const started = Date.now();
    const maxMs = 300_000; // 5 minutos
    while (!token.stop && Date.now() - started < maxMs) {
      await new Promise((r) => setTimeout(r, 1500));
      if (token.stop) return;
      try {
        const r = await fetchQrFn({ data: { apiToken } });
        if (token.stop) return;
        
        if (r.qrCode) {
          setQrCodeData(r.qrCode);
          await upsertSessao({ status: "aguardando_qr", qr_code: r.qrCode });
        }
        
        if (r.state === "conectado") {
          await upsertSessao({
            status: "conectado",
            qr_code: null,
            connected_at: new Date().toISOString(),
          });
          toast.success("WhatsApp Conectado com sucesso!");
          setIsQrModalOpen(false); // Fecha o modal automaticamente
          stopPolling();
          return;
        }
      } catch (err) {
        console.warn("[qr poll]", err);
      }
    }
    if (!token.stop) {
      toast.error("Tempo esgotado ao buscar o QR Code.");
    }
    pollRef.current = null;
  }

  async function upsertSessao(patch: Partial<WhatsAppSessao>): Promise<WhatsAppSessao | null> {
    if (!clinicaId || !unidadeId) return null;
    const isAgencia = clinicaId === "agencia" || unidadeId === "agencia-principal";
    
    const payload = {
      clinica_id: isAgencia ? null : clinicaId,
      unidade_id: isAgencia ? null : unidadeId,
      instance_name: sessao?.instance_name ?? inputInstanceName,
      ...patch,
    };
    
    let existing;
    if (isAgencia) {
      const { data } = await (supabase as unknown as { from: (t: string) => any })
         .from("whatsapp_sessoes").select("id").is("unidade_id", null).maybeSingle();
      existing = data;
    } else {
      const { data } = await (supabase as unknown as { from: (t: string) => any })
         .from("whatsapp_sessoes").select("id").eq("unidade_id", unidadeId).maybeSingle();
      existing = data;
    }

    let result;
    if (existing) {
       const { data, error } = await (supabase as unknown as { from: (t: string) => any })
         .from("whatsapp_sessoes").update(payload).eq("id", existing.id).select().single();
       if (error) { toast.error(error.message); return null; }
       result = data;
    } else {
       const { data, error } = await (supabase as unknown as { from: (t: string) => any })
         .from("whatsapp_sessoes").insert(payload).select().single();
       if (error) { toast.error(error.message); return null; }
       result = data;
    }
    
    const next = result as WhatsAppSessao;
    setSessao(next);
    return next;
  }

  async function handleCriarInstancia() {
    if (!unidadeId || !inputInstanceName) {
      toast.error("O nome da instância é obrigatório.");
      return;
    }
    setWorking(true);
    try {
      const res = await createInstanceFn({
        data: { unidadeId, instanceName: inputInstanceName, phoneNumber: inputPhoneNumber || null },
      });
      await upsertSessao({
        instance_name: inputInstanceName,
        status: "desconectado",
        api_token: res.apiToken ?? null,
        numero_conectado: inputPhoneNumber || null,
      });
      toast.success("Instância criada com sucesso! Agora você pode gerar o QR Code.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao criar instância.");
    } finally {
      setWorking(false);
    }
  }

  async function handleGerarQr() {
    if (!sessao || !sessao.api_token) return;
    setWorking(true);
    try {
      const res = await generateQrFn({
        data: { apiToken: sessao.api_token },
      });
      
      setQrCodeData(res.qrCode ?? null);
      setIsQrModalOpen(true);
      
      await upsertSessao({
        status: "aguardando_qr",
        qr_code: res.qrCode ?? null,
      });
      
      // Iniciar polling para ver se o usuário leu o QR Code
      startQrPolling(sessao.api_token);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao gerar QR Code");
    } finally {
      setWorking(false);
    }
  }

  async function handleVerificar() {
    if (!sessao || !sessao.api_token) return;
    setWorking(true);
    try {
      const res = await fetchStatusFn({ data: { apiToken: sessao.api_token } });
      const patch: Partial<WhatsAppSessao> = {
        status: res.status as SessaoStatus,
        last_seen_at: new Date().toISOString(),
      };
      if (res.status === "conectado") {
        patch.qr_code = null;
        if (res.numero) patch.numero_conectado = res.numero;
        if (!sessao.connected_at) patch.connected_at = new Date().toISOString();
      }
      await upsertSessao(patch);
      toast.success(`Status: ${res.status}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao verificar conexão");
    } finally {
      setWorking(false);
    }
  }

  async function handleReconectar() {
    if (!sessao || !sessao.api_token) return;
    setWorking(true);
    try {
      await restartFn({ data: { apiToken: sessao.api_token } });
      await upsertSessao({ status: "reconectando", qr_code: null });
      toast("Reconectando…");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao reconectar");
    } finally {
      setWorking(false);
    }
  }

  async function handleDesconectar() {
    if (!sessao || !sessao.api_token) return;
    stopPolling();
    setWorking(true);
    try {
      await disconnectFn({ data: { apiToken: sessao.api_token } });
      await upsertSessao({
        status: "desconectado",
        qr_code: null,
        numero_conectado: null,
        connected_at: null,
      });
      toast("WhatsApp desconectado.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao desconectar");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeletarInstancia() {
    if (!sessao || !sessao.api_token) return;
    if (!confirm("Tem certeza que deseja excluir esta instância permanentemente? Esta ação não pode ser desfeita.")) return;
    
    stopPolling();
    setWorking(true);
    try {
      // 1. Excluir da WUZAPI
      await deleteInstanceFn({ data: { apiToken: sessao.api_token } });
      
      // 2. Excluir do Supabase
      let query = (supabase as unknown as { from: (t: string) => any }).from("whatsapp_sessoes").delete();
      if (unidadeId === "agencia-principal") {
        query = query.is("unidade_id", null);
      } else {
        query = query.eq("unidade_id", unidadeId);
      }
      const { error } = await query;
        
      if (error) throw new Error(error.message);
      
      setSessao(null);
      setProfilePictureUrl(null);
      toast.success("Instância deletada com sucesso.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao deletar instância");
    } finally {
      setWorking(false);
    }
  }

  const status: SessaoStatus = sessao?.status ?? "desconectado";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Conexão WhatsApp"
        description="Conecte o WhatsApp de cada unidade configurando uma instância WUZAPI."
      />

      {role !== "recepcao" && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
              Clínica
            </label>
            <Select value={clinicaId} onValueChange={setClinicaId} disabled={scopeLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a clínica" />
              </SelectTrigger>
              <SelectContent>
                {role === "agencia" && (
                  <SelectItem value="agencia">🌟 Agência (Super Admin)</SelectItem>
                )}
                {clinicas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
              Unidade
            </label>
            <Select value={unidadeId} onValueChange={setUnidadeId} disabled={!clinicaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {clinicaId === "agencia" ? (
                  <SelectItem value="agencia-principal">Conexão Principal</SelectItem>
                ) : (
                  unidadesFiltradas.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {!unidadeId ? (
        <div className="bg-card border border-black/5 rounded-xl p-10 text-center text-muted-foreground text-sm">
          Selecione uma clínica e uma unidade para gerenciar a sessão de WhatsApp.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-black/5 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-6 border-b border-black/5 pb-4">
            <div className="flex items-center gap-4">
              {profilePictureUrl && status === "conectado" && (
                <img src={profilePictureUrl} alt="Foto de Perfil" className="size-12 rounded-full object-cover border border-black/10 shadow-sm" />
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {clinicaId === "agencia" ? "Administração" : clinica?.nome ?? "—"}
                </p>
                <h2 className="text-xl font-semibold">{clinicaId === "agencia" ? "Super Admin" : unidade?.nome ?? "—"}</h2>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex flex-col justify-center min-h-[320px]">
              {loadingSessao ? (
                <div className="flex justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : !sessao ? (
                <div className="w-full bg-muted/30 p-6 rounded-xl border border-black/5">
                  <PlugZap className="size-10 text-muted-foreground mb-4 opacity-50" />
                  <p className="font-semibold text-foreground mb-4 text-lg">Criar Nova Instância</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                        Nome da Instância
                      </label>
                      <Input
                        value={inputInstanceName}
                        onChange={(e) => setInputInstanceName(e.target.value)}
                        placeholder="Ex: recepcao-matriz"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                        Número do WhatsApp
                      </label>
                      <Input
                        value={inputPhoneNumber}
                        onChange={(e) => setInputPhoneNumber(e.target.value)}
                        placeholder="Ex: 5511999999999"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Apenas números, com código do país.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/30 p-6 rounded-xl border border-black/5 text-center flex flex-col items-center justify-center h-full">
                  {status === "conectado" ? (
                    <>
                      <div className="size-20 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center shadow-inner">
                        <CheckCircle2 className="size-10 text-emerald-700" />
                      </div>
                      <p className="font-bold text-lg">WhatsApp Conectado</p>
                    </>
                  ) : (
                    <>
                      <div className="size-20 mx-auto mb-4 bg-brand/10 rounded-full flex items-center justify-center">
                        <Smartphone className="size-10 text-brand" />
                      </div>
                      <p className="font-bold text-lg">Instância Pronta</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Gere o QR Code para conectar.
                      </p>
                    </>
                  )}
                  
                  <div className="mt-6 w-full text-left bg-white p-4 rounded-lg border border-black/5">
                    <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Detalhes da Instância</p>
                    <p className="font-semibold">{sessao.instance_name}</p>
                    {sessao.numero_conectado && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2">
                        <Smartphone className="size-3.5" />
                        {sessao.numero_conectado}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 flex flex-col justify-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Ações Disponíveis</p>
              
              {!sessao ? (
                <Button
                  onClick={handleCriarInstancia}
                  disabled={working || !inputInstanceName}
                  className="w-full justify-start h-12 bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm"
                >
                  <PlugZap className="size-4 mr-3" /> Criar Instância
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleGerarQr}
                    disabled={working || status === "conectado"}
                    className="w-full justify-start h-12 bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm"
                  >
                    <QrCode className="size-4 mr-3" /> Gerar QR Code
                  </Button>
                  <Button
                    onClick={handleVerificar}
                    disabled={working}
                    variant="outline"
                    className="w-full justify-start h-12"
                  >
                    <RefreshCw className="size-4 mr-3" /> Verificar conexão
                  </Button>
                  <Button
                    onClick={handleReconectar}
                    disabled={working}
                    variant="outline"
                    className="w-full justify-start h-12"
                  >
                    <PlugZap className="size-4 mr-3" /> Reconectar
                  </Button>
                  <Button
                    onClick={handleDesconectar}
                    disabled={working || status === "desconectado"}
                    variant="outline"
                    className="w-full justify-start h-12 border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    <LogOut className="size-4 mr-3" /> Desconectar WhatsApp
                  </Button>
                  <Button
                    onClick={handleDeletarInstancia}
                    disabled={working}
                    variant="outline"
                    className="w-full justify-start h-12 bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                  >
                    <AlertTriangle className="size-4 mr-3" /> Deletar Instância
                  </Button>
                </>
              )}

              {sessao && (
                <div className="mt-6 pt-4 border-t border-black/5 space-y-2 text-xs">
                  <Info label="Token Interno" value={sessao.api_token ? `••••${sessao.api_token.slice(-6)}` : "—"} />
                  <Info
                    label="Última Atividade"
                    value={
                      sessao.last_seen_at
                        ? new Date(sessao.last_seen_at).toLocaleString("pt-BR")
                        : "—"
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {sessao && (
          <div className="bg-card border border-black/5 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-black/5 pb-4">
              <Bot className="size-6 text-brand" />
              <h2 className="text-xl font-semibold">Agente de IA</h2>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Ativar Agente de IA</h3>
                  <p className="text-sm text-muted-foreground">
                    A IA irá responder automaticamente aos tutores seguindo as instruções abaixo.
                  </p>
                </div>
                <Switch
                  checked={iaAtiva}
                  onCheckedChange={setIaAtiva}
                  disabled={working}
                />
              </div>

              <div>
                <h3 className="font-medium mb-2">Instruções do Agente (System Prompt)</h3>
                <Textarea
                  value={iaPrompt}
                  onChange={(e) => setIaPrompt(e.target.value)}
                  placeholder="Ex: Você é um assistente virtual da clínica..."
                  className="min-h-[120px] resize-y"
                  disabled={working}
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleSaveIaSettings} disabled={working} size="sm">
                    Salvar Configurações
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      <Dialog open={isQrModalOpen} onOpenChange={(open) => {
        setIsQrModalOpen(open);
        if (!open) stopPolling();
      }}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Escaneie o QR Code</DialogTitle>
            <DialogDescription className="text-center">
              Abra o WhatsApp do número <strong>{sessao?.numero_conectado || "da unidade"}</strong>, vá em Aparelhos Conectados e aponte a câmera.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 min-h-[300px]">
            {qrCodeData ? (
              qrCodeData.startsWith("data:image") ? (
                <img
                  src={qrCodeData}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 rounded-xl border border-black/10 bg-white p-2 shadow-sm"
                />
              ) : (
                <MockQrCode seed={qrCodeData} />
              )
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="size-10 animate-spin text-brand" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}
