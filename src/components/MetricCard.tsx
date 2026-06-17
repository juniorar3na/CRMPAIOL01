import type { ReactNode } from "react";

type Tone = "default" | "urgent" | "warning" | "success";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const toneClasses: Record<Tone, string> = {
    default: "bg-card ring-1 ring-black/5",
    urgent: "bg-urgent-surface ring-1 ring-urgent/30",
    warning: "bg-warning-surface ring-1 ring-warning/30",
    success: "bg-brand-surface ring-1 ring-brand/15",
  };
  const valueClasses: Record<Tone, string> = {
    default: "text-foreground",
    urgent: "text-urgent",
    warning: "text-foreground",
    success: "text-brand",
  };
  return (
    <div className={`p-5 rounded-xl ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-semibold leading-none ${valueClasses[tone]}`}>{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
