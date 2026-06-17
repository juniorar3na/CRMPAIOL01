import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ScopeProvider } from "@/lib/ScopeContext";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }
  if (!user || !role) return <Navigate to="/login" />;
  return (
    <ScopeProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ScopeProvider>
  );
}
