import type { ReactNode } from "react";
import { MarketNav } from "@/components/market-nav";

type AdminHeroShellProps = {
  copy: ReactNode;
  children: ReactNode;
};

export function AdminHeroShell({ copy, children }: AdminHeroShellProps) {
  return (
    <main className="page market-shell market-shell-auth admin-auth-page">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="market-shell-auth-content admin-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide admin-auth-shell">
          <aside className="auth-flow-copy admin-auth-copy">{copy}</aside>
          <section className="auth-flow-panel auth-flow-panel-wide admin-auth-panel">{children}</section>
        </section>
      </div>
    </main>
  );
}
