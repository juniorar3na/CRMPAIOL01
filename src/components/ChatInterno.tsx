import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useScope, useCurrentScope } from "@/lib/scope";
import type { DbChatInterno } from "@/lib/db-types";
import { Send, MessageSquare, Image as ImageIcon, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { horaCurta } from "@/lib/db-types";

export function ChatInterno() {
  const { session, role } = useAuth();
  const { clinicas, unidades } = useScope();
  const { clinicaId, unidadeId } = useCurrentScope();
  
  const [mensagens, setMensagens] = useState<DbChatInterno[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determinar o nome do remetente
  const clinica = clinicas.find(c => c.id === clinicaId);
  const unidade = unidades.find(u => u.id === unidadeId);
  
  const remetenteNome = role === "recepcao" 
    ? `Recepção - ${unidade?.nome || "Unidade"}`
    : `Gestor - ${clinica?.nome || "Clínica"}`;

  useEffect(() => {
    if (!clinicaId) return;

    let alive = true;

    async function loadMensagens() {
      const { data, error } = await supabase
        .from("chat_interno_mensagens")
        .select("*")
        .eq("clinica_id", clinicaId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao carregar chat interno:", error);
      } else if (alive) {
        setMensagens(data ?? []);
        setLoading(false);
      }
    }

    loadMensagens();

    const channel = supabase
      .channel(`chat_interno_${clinicaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_interno_mensagens",
          filter: `clinica_id=eq.${clinicaId}`,
        },
        (payload) => {
          if (alive) {
            setMensagens((prev) => [...prev, payload.new as DbChatInterno]);
          }
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [clinicaId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !session?.user.id || !clinicaId) return;

    const mensagemParaEnviar = texto;
    setTexto("");

    const novaMensagem = {
      clinica_id: clinicaId,
      unidade_id: unidadeId || null,
      user_id: session.user.id,
      remetente_nome: remetenteNome,
      mensagem: mensagemParaEnviar,
    };

    const { error } = await supabase
      .from("chat_interno_mensagens")
      .insert(novaMensagem);

    if (error) {
      toast.error("Erro ao enviar mensagem");
      console.error(error);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session?.user.id || !clinicaId) return;

    if (file.size > 5 * 1024 * 1024) {
      return toast.error("A imagem deve ter no máximo 5MB.");
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${clinicaId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("chat_interno")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("chat_interno").getPublicUrl(filePath);
      
      const novaMensagem = {
        clinica_id: clinicaId,
        unidade_id: unidadeId || null,
        user_id: session.user.id,
        remetente_nome: remetenteNome,
        mensagem: texto.trim() || "[Imagem anexada]",
        image_url: data.publicUrl,
      };

      const { error: dbError } = await supabase
        .from("chat_interno_mensagens")
        .insert(novaMensagem);

      if (dbError) throw dbError;
      
      setTexto(""); // Limpa o texto se havia algum
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload da imagem");
      console.error(error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground text-sm">Carregando chat interno...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-muted/20 border-x border-black/5 max-w-4xl mx-auto shadow-sm">
      {/* Header */}
      <div className="h-16 px-6 bg-white border-b border-black/5 flex items-center gap-3 shrink-0">
        <div className="size-10 bg-brand/10 rounded-full flex items-center justify-center">
          <MessageSquare className="size-5 text-brand" />
        </div>
        <div>
          <h1 className="font-semibold text-lg tracking-tight">Chat Interno da Clínica</h1>
          <p className="text-xs text-muted-foreground">
            {role === "recepcao" ? "Fale com o gestor e outras unidades" : "Fale com todas as suas unidades"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {mensagens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
            <MessageSquare className="size-12 mb-3" />
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-sm">Comece a conversa agora!</p>
          </div>
        ) : (
          mensagens.map((msg) => {
            const isMe = msg.user_id === session?.user.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[10px] font-medium text-muted-foreground mb-1 px-1">
                  {msg.remetente_nome} • {horaCurta(msg.created_at)}
                </span>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[15px] ${
                    isMe
                      ? "bg-brand text-brand-foreground rounded-tr-sm"
                      : "bg-white border border-black/5 text-foreground rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.image_url && (
                    <a href={msg.image_url} target="_blank" rel="noreferrer">
                      <img 
                        src={msg.image_url} 
                        alt="Anexo" 
                        className="max-w-[240px] max-h-[300px] object-cover rounded-md mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  {msg.mensagem !== "[Imagem anexada]" && <span>{msg.mensagem}</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-black/5">
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-5" />}
          </Button>
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite uma mensagem para a clínica..."
            className="rounded-full bg-muted/50"
            disabled={isUploading}
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!texto.trim() && !isUploading}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
