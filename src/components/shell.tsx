import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, Compass, MessagesSquare, Shield } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Nusa", short: "Nusa", icon: MessagesSquare, exact: true },
  { to: "/vitacheck", label: "VitaCheck", short: "Cek", icon: ClipboardCheck, exact: false },
  { to: "/navigator", label: "Navigator", short: "Arah", icon: Compass, exact: false },
  { to: "/edukasi", label: "Edukasi", short: "Baca", icon: BookOpen, exact: false },
  { to: "/prinsip", label: "Prinsip", short: "Batas", icon: Shield, exact: false },
] as const;

function LeafMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-leaf" />
      <path
        d="M16 5.5c1.6 5.2 5.2 7.4 9.5 8.6-5.4 1.6-7.6 4.6-8.8 10.2C15.4 18.6 12.4 16 7 14.2 12.2 12.8 14.6 10.2 16 5.5z"
        className="fill-paper"
      />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <LeafMark />
      <span className="leading-none">
        <span className="block font-display text-xl tracking-tight">
          Vita<span className="italic">Nusa</span>
        </span>
        {!compact && <span className="mt-1 block text-xs tracking-wide text-muted">Edukasi, bukan diagnosis</span>}
      </span>
    </Link>
  );
}

function useActive() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (to: string, exact: boolean) => (exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
}

export function Shell({ children }: { children: ReactNode }) {
  const active = useActive();

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-sheet md:flex">
        <div className="px-5 py-6">
          <Brand />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {items.map((item) => {
            const on = active(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-2xl px-3 text-base transition-colors",
                  on ? "bg-leaf-soft text-leaf" : "text-ink hover:bg-paper",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-5 py-6 text-sm leading-relaxed text-muted">
          Nusa membantu memahami kebiasaan dan klaim. Untuk tanda bahaya, hubungi 119.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-line bg-sheet px-4 md:hidden">
          <Brand compact />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <nav className="grid grid-cols-5 border-t border-line bg-sheet md:hidden">
          {items.map((item) => {
            const on = active(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                  on ? "text-leaf" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {item.short}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
