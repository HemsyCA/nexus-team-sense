import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessagesSquare,
  Sparkles,
  BarChart3,
  GitBranch,
  Shield,
  Bell,
  Search,
  Home as HomeIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/home", label: "Inicio", icon: HomeIcon },
  { to: "/feed", label: "Feed Anónimo", icon: MessagesSquare },
  { to: "/chat", label: "Chat IA", icon: Sparkles },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/simulaciones", label: "Simulaciones", icon: GitBranch },
  { to: "/configuracion", label: "Privacidad", icon: Shield },
] as const;

export function AppLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-brand-bg text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-brand-navy text-white lg:flex">
        <div className="flex flex-1 flex-col p-6">
          <Link to="/home" className="mb-10 flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-brand-blue font-bold text-brand-navy shadow-lg shadow-brand-blue/20">
              N
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight">NEXUS LEAD</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-blue">IA</div>
            </div>
          </Link>

          <nav className="space-y-1">
            {nav.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors " +
                    (active
                      ? "bg-white/10 font-semibold text-brand-blue"
                      : "text-white/70 hover:bg-white/5 hover:text-white")
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                Estado del Sistema
              </p>
              <div className="flex items-center gap-2">
                <span className="relative grid size-2 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-emerald/60" />
                  <span className="size-2 rounded-full bg-brand-emerald" />
                </span>
                <span className="text-sm font-medium text-white">100% Anónimo</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-brand-bg/80 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium shadow-sm sm:flex">
              <span className="size-1.5 rounded-full bg-brand-purple" />
              Nexus IA Online
            </div>
            <button className="grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground">
              <Bell className="size-4" />
            </button>
            <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-brand-blue to-brand-purple text-sm font-bold text-white outline-2 outline-white">
              LD
            </div>
          </div>
        </header>

        <main className="px-5 pb-28 pt-6 sm:px-8 sm:pb-12 sm:pt-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-card/95 px-2 py-2 backdrop-blur lg:hidden">
        {nav.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition " +
                (active ? "text-brand-blue" : "text-muted-foreground")
              }
            >
              <Icon className="size-4" />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-border bg-card p-6 shadow-sm shadow-slate-900/[0.02] " +
        className
      }
    >
      {children}
    </div>
  );
}
