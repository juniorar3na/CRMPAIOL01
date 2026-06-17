import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth, ROLE_HOME } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (!role) return <Navigate to="/login" />;
  return <Navigate to={ROLE_HOME[role]} />;
}
