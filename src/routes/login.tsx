import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, ROLE_HOME, ROLE_LABEL, type AppRole } from "@/lib/auth";
import { PawPrint } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Recepção IA Vet" },
      { name: "description", content: "Acesse sua conta da Recepção IA Vet." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, user, role } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chosenRole, setChosenRole] = useState<AppRole>("gestor");
  const [submitting, setSubmitting] = useState(false);
  
  // Dados extras para o gestor criar a clínica
  const [clinicaNome, setClinicaNome] = useState("");
  const [clinicaRede, setClinicaRede] = useState("");
  const [clinicaCnpj, setClinicaCnpj] = useState("");
  const [clinicaResponsavel, setClinicaResponsavel] = useState("");
  const [clinicaTelefone, setClinicaTelefone] = useState("");
  const [clinicaEmail, setClinicaEmail] = useState("");

  if (user && role) {
    navigate({ to: ROLE_HOME[role] });
  }

  function traduzirErro(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("weak") || m.includes("pwned"))
      return "Essa senha apareceu em vazamentos públicos e não é segura. Use uma senha diferente (mín. 8 caracteres, misturando letras, números e símbolos).";
    if (m.includes("invalid login") || m.includes("invalid credentials"))
      return "E-mail ou senha incorretos. Confira e tente novamente.";
    if (m.includes("already registered") || m.includes("user already"))
      return "Já existe uma conta com este e-mail. Use 'Entrar'.";
    if (m.includes("email") && m.includes("invalid"))
      return "E-mail inválido. Verifique o endereço digitado.";
    if (m.includes("password") && m.includes("short"))
      return "A senha precisa ter pelo menos 6 caracteres.";
    if (m.includes("rate") || m.includes("too many"))
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    return msg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && password.length < 8) {
      toast.error("Use uma senha com pelo menos 8 caracteres, misturando letras, números e símbolos.");
      return;
    }
    setSubmitting(true);
    const clinicData =
      chosenRole === "gestor"
        ? {
            nome: clinicaNome,
            rede: clinicaRede,
            cnpj: clinicaCnpj,
            responsavel: clinicaResponsavel,
            telefone: clinicaTelefone,
            email: clinicaEmail || email, // fallback para o email de login se o campo ficar vazio
          }
        : undefined;

    const res =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, chosenRole, clinicData);
    setSubmitting(false);
    if (res.error) {
      toast.error(traduzirErro(res.error));
      return;
    }
    if (mode === "signup" && chosenRole === "gestor") {
      // O auth.tsx irá cuidar de deslogar e dar o aviso no toast.
      // Apenas resetamos o modo para login
      setMode("login");
      return;
    }

    toast.success(mode === "login" ? "Bem-vinda(o) de volta!" : "Conta criada!");
    const target = mode === "signup" ? ROLE_HOME[chosenRole] : "/";
    navigate({ to: target });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="size-10 bg-brand rounded-xl flex items-center justify-center text-brand-foreground">
            <PawPrint className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight text-lg leading-none">Recepção IA Vet</p>
            <p className="text-xs text-muted-foreground mt-1">Atendimento veterinário inteligente</p>
          </div>
        </div>

        <div className="bg-card ring-1 ring-black/5 rounded-2xl p-8 shadow-sm">
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@clinica.com.br"
                className="w-full h-11 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Senha
              </label>
              <input
                type="password"
                required
                minLength={mode === "signup" ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              {mode === "signup" && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Mín. 8 caracteres. Evite senhas comuns (nome + datas) — são bloqueadas por segurança.
                </p>
              )}
            </div>

            {mode === "signup" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Tipo de acesso
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    className="px-2 py-2.5 text-xs font-medium rounded-lg ring-1 transition-colors bg-brand-surface ring-brand text-brand"
                  >
                    Gestor da clínica
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Em produção, o tipo de acesso vem do convite enviado pela agência.
                </p>
              </div>
            )}

            {mode === "signup" && chosenRole === "gestor" && (
              <div className="space-y-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Dados da sua Clínica
                </p>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Nome da Clínica *
                  </label>
                  <input
                    type="text"
                    required
                    value={clinicaNome}
                    onChange={(e) => setClinicaNome(e.target.value)}
                    className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Rede
                    </label>
                    <input
                      type="text"
                      value={clinicaRede}
                      onChange={(e) => setClinicaRede(e.target.value)}
                      className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={clinicaCnpj}
                      onChange={(e) => setClinicaCnpj(e.target.value)}
                      className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Responsável
                    </label>
                    <input
                      type="text"
                      value={clinicaResponsavel}
                      onChange={(e) => setClinicaResponsavel(e.target.value)}
                      className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={clinicaTelefone}
                      onChange={(e) => setClinicaTelefone(e.target.value)}
                      className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    E-mail Comercial
                  </label>
                  <input
                    type="email"
                    value={clinicaEmail}
                    onChange={(e) => setClinicaEmail(e.target.value)}
                    placeholder="Opcional. Usará o e-mail de login se vazio"
                    className="w-full h-10 px-3 bg-background ring-1 ring-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-brand text-brand-foreground font-medium rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Aguarde…" : mode === "login" ? "Entrar no sistema" : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
