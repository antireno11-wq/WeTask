"use client";

import { MarketNav } from "@/components/market-nav";
import { LoginRolePanel } from "@/components/login-role-panel";

export default function IngresarClientePage() {
  return (
    <main className="page market-shell">
      <MarketNav />
      <LoginRolePanel role="CUSTOMER" />
    </main>
  );
}
