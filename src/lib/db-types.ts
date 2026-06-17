// Tipos UI alinhados ao schema do banco.
import type { Database } from "@/integrations/supabase/types";

export type DbClinica = Database["public"]["Tables"]["clinicas"]["Row"];
export type DbUnidade = Database["public"]["Tables"]["unidades"]["Row"];
export type DbBaseItem = Database["public"]["Tables"]["base_conhecimento"]["Row"];
export type DbRegrasIA = Database["public"]["Tables"]["regras_ia"]["Row"];
export type DbConversa = Database["public"]["Tables"]["conversas"]["Row"];
export type DbMensagem = Database["public"]["Tables"]["mensagens"]["Row"];
export type DbExame = Database["public"]["Tables"]["exames"]["Row"];
export type DbInternacao = Database["public"]["Tables"]["internacoes"]["Row"];

export type DbChatInterno = {
  id: string;
  clinica_id: string;
  unidade_id: string | null;
  user_id: string;
  remetente_nome: string;
  mensagem: string;
  image_url?: string | null;
  created_at: string;
};

export type Prioridade = "Urgente" | "Alta" | "Normal" | "Baixa";
export type StatusAtend =
  | "Aguardando humano"
  | "Em atendimento"
  | "Finalizado"
  | "IA respondendo";

export const CATEGORIAS_BASE = [
  "Consulta",
  "Vacinas",
  "Exames",
  "Internação",
  "Castração",
  "Banho e tosa",
  "Emergência 24h",
  "Formas de pagamento",
  "Campanhas ativas",
  "Valores permitidos",
  "Links úteis",
  "Perguntas frequentes",
] as const;

export function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diff / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
