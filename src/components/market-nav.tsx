"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

export function MarketNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<{ fullName?: string | null; role?: string | null } | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { fullName?: string | null; role?: string | null } | null };
        setSession(data.session ?? null);
      } catch {
        setSession(null);
      }
    };
    void loadSession();
  }, [pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    router.push("/");
    router.refresh();
  };

  const role = session?.role ?? null;
  const roleLabel = role === "PRO" ? "Tasker" : role === "ADMIN" ? "Admin" : role === "CUSTOMER" ? "Cliente" : role;
  const accountHref = role === "PRO" ? "/pro" : "/cliente";
  const isAdminArea = pathname.startsWith("/admin");
  const primaryLinks = isAdminArea
    ? []
    : [
        { href: "/", label: "Inicio" },
        { href: "/como-funciona", label: "Cómo funciona" },
        { href: "/services", label: "Servicios" },
      ];
  const guestLinks = isAdminArea
    ? []
    : [
        { href: "/trabaja-con-nosotros", label: "Soy tasker" },
        { href: "/registro", label: "Soy cliente" }
      ];

  return (
    <header className="market-nav">
      <Link href="/" className="brand-link">
        <BrandLogo className="brand-logo" width={170} height={68} variant="white-wordmark" />
      </Link>
      <div className="nav-right">
        <nav>
          {primaryLinks.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="auth-nav">
          {session?.role ? <span className="auth-badge">{session.fullName ?? "Usuario"} · {roleLabel}</span> : null}
          {session?.role ? (
            <>
              <Link href={accountHref} className="nav-link auth-btn">
                Mi cuenta
              </Link>
              <button type="button" className="nav-link auth-btn" onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <>
              {guestLinks.map((item) => (
                <Link key={item.href} href={item.href} className="nav-link auth-btn">
                  {item.label}
                </Link>
              ))}
              <Link href="/ingresar" className="nav-link auth-btn auth-login-pill">
                Acceder
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
