// Lightweight mock data store persisted in localStorage for prototype demo.
import { useEffect, useState, useCallback } from "react";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function useMockList<T extends { id: string }>(key: string) {
  const [items, setItems] = useState<T[]>(() => load<T[]>(key, []));

  useEffect(() => {
    save(key, items);
  }, [key, items]);

  const add = useCallback((item: Omit<T, "id">) => {
    const newItem = { ...(item as object), id: crypto.randomUUID() } as T;
    setItems((prev) => [newItem, ...prev]);
    return newItem;
  }, []);

  const update = useCallback((id: string, patch: Partial<T>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  return { items, add, update, remove };
}

// Types
export type Clinica = {
  id: string;
  nome: string;
  rede: string;
  cnpj: string;
  responsavel: string;
  telefone: string;
  email: string;
  status: "Ativo" | "Pendente" | "Inativo";
  plano: string;
};

export type Unidade = {
  id: string;
  clinicaId: string;
  nome: string;
  endereco: string;
  horario: string;
  atendimento24h: boolean;
  whatsapp: string;
  servicos: string;
  links: string;
  linkLab: string;
  linkMaps: string;
  observacoes: string;
};

export type Internacao = {
  id: string;
  tutor: string;
  cpf: string;
  pet: string;
  unidade: string;
  data: string;
  status: "aguardando equipe" | "respondido" | "finalizado";
  observacoes: string;
  mensagemAutorizada: string;
};

export type Exame = {
  id: string;
  tutor: string;
  cpf: string;
  pet: string;
  tipo: string;
  linkLab: string;
  loginInformado: boolean;
  senhaInformada: boolean;
  status: "aguardando" | "link enviado" | "precisa de humano" | "finalizado";
};

export type BaseItem = {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
};

export type RegrasIA = {
  boasVindas: string;
  tomVoz: string;
  quandoResponderSozinha: string;
  quandoChamarHumano: string;
  palavrasUrgencia: string;
  servicosRecepcao: string;
  infoBloqueada: string;
  mensagemSensivel: string;
};

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
  "Links de laboratório",
  "Regras para resultado de exame",
  "Regras para atualização de internação",
];
