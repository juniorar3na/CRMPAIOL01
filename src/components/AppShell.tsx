import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  BookOpen,
  Bot,
  BarChart3,
  Headset,
  Stethoscope,
  FlaskConical,
  LogOut,
  PawPrint,
  QrCode,
  Cpu,
  MessageSquare,
} from "lucide-react";
import { useAuth, ROLE_LABEL, type AppRole } from "@/lib/auth";
import { ScopeSwitcher } from "@/components/ScopeSwitcher";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const NAV: Record<AppRole, NavItem[]> = {
  agencia: [
    { to: "/agencia/clinicas", label: "Clínicas", icon: Building2 },
    { to: "/agencia/unidades", label: "Unidades", icon: MapPin },
    { to: "/agencia/base-conhecimento", label: "Base de conhecimento", icon: BookOpen },
    { to: "/agencia/regras-ia", label: "Regras da IA", icon: Bot },
    { to: "/agencia/configuracoes-ia", label: "Configurações da OpenAI", icon: Cpu },
    { to: "/agencia/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/conexao-whatsapp", label: "Conexão WhatsApp", icon: QrCode },
  ],
  gestor: [
    { to: "/gestor/atendimentos", label: "Atendimentos", icon: Headset },
    { to: "/gestor/chat-interno", label: "Chat Interno", icon: MessageSquare },
    { to: "/gestor/unidades", label: "Unidades", icon: MapPin },
    { to: "/gestor/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/conexao-whatsapp", label: "Conexão WhatsApp", icon: QrCode },
  ],
  recepcao: [
    { to: "/recepcao", label: "Atendimentos", icon: Headset },
    { to: "/recepcao/chat-interno", label: "Chat Interno", icon: MessageSquare },
    { to: "/conexao-whatsapp", label: "Conexão WhatsApp", icon: QrCode },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = role ? NAV[role] : [];

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 flex items-center gap-2">
          <div className="size-9 bg-brand rounded-lg flex items-center justify-center text-brand-foreground">
            <PawPrint className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">Recepção IA Vet</p>
            <p className="text-[11px] text-muted-foreground">{role ? ROLE_LABEL[role] : ""}</p>
          </div>
        </div>

        <ScopeSwitcher />

        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.to ||
              (item.to !== "/agencia" && item.to !== "/gestor" && item.to !== "/recepcao" &&
                pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? "bg-brand-surface text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground mb-2 truncate" title={user?.email ?? ""}>
            {user?.email}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-[60ch] text-pretty">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
