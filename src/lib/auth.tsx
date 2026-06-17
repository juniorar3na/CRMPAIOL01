import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppRole = "agencia" | "gestor" | "recepcao";

export const ROLE_LABEL: Record<AppRole, string> = {
  agencia: "Super Admin (SaaS)",
  gestor: "Gestor da clínica",
  recepcao: "Recepção",
};

export const ROLE_HOME: Record<AppRole, string> = {
  agencia: "/agencia",
  gestor: "/gestor",
  recepcao: "/recepcao",
};

export type ClinicSignupData = {
  nome: string;
  rede: string;
  cnpj: string;
  responsavel: string;
  telefone: string;
  email: string;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, role: AppRole, clinicData?: ClinicSignupData) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadRole(sess.user.id), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadRole(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role, clinica_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.role === "gestor" && data.clinica_id) {
      const { data: clinica } = await supabase
        .from("clinicas")
        .select("status")
        .eq("id", data.clinica_id)
        .maybeSingle();
      
      if (clinica?.status !== "ativo") {
        await supabase.auth.signOut();
        setRole(null);
        toast.error("Aguarde liberação do acesso por parte do Administrador");
        return;
      }
    }

    setRole((data?.role as AppRole) ?? null);
  }

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp: AuthState["signUp"] = async (email, password, chosenRole, clinicData) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) return { error: error.message };
    const uid = data.user?.id;
    if (uid) {
      if (chosenRole === "gestor" && clinicData) {
        // Usa a RPC que insere a clínica e associa o gestor à clínica recém-criada
        const { error: rpcErr } = await supabase.rpc("register_clinic_and_role", {
          _nome: clinicData.nome,
          _rede: clinicData.rede,
          _cnpj: clinicData.cnpj,
          _responsavel: clinicData.responsavel,
          _telefone: clinicData.telefone,
          _email: clinicData.email,
        });
        if (rpcErr) return { error: rpcErr.message };
        
        // O loadRole cuidará de verificar o status da clínica e deslogar.
        // Apenas retornamos sucesso na criação para não dar erro.
        return { error: null };
      } else {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({ user_id: uid, role: chosenRole });
        if (roleErr) return { error: roleErr.message };
        setRole(chosenRole);
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
