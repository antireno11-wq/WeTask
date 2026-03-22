import type { ReactNode } from "react";
import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

type AdminHeroShellProps = {
  children: ReactNode;
};

export function AdminHeroShell({ children }: AdminHeroShellProps) {
  return (
    <main className="page market-shell market-shell-auth admin-auth-page">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="market-shell-auth-content admin-auth-content">
        <MarketNav />
        <div className="admin-shell-actions">
          <Link href="/admin" className="cta ghost small admin-head-action">
            Volver al inicio
          </Link>
        </div>

        <section className="admin-auth-shell">
          <section className="auth-flow-panel auth-flow-panel-wide admin-auth-panel admin-auth-panel-full">{children}</section>
        </section>
      </div>
    </main>
  );
}
