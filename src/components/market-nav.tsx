"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function MarketNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [logoSrc, setLogoSrc] = useState("/logo-wetask-cropped.png");
  const [session, setSession] = useState<{ fullName?: string | null; role?: string | null } | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/logo-wetask-cropped.png";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = frame.data;

      // Convert near-white matte background to transparent.
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const isWhite = r > 244 && g > 244 && b > 244;
        const isNearWhite = r > 230 && g > 230 && b > 230;
        if (isWhite) {
          pixels[i + 3] = 0;
        } else if (isNearWhite) {
          pixels[i + 3] = Math.min(pixels[i + 3], 110);
        }
      }

      ctx.putImageData(frame, 0, 0);
      setLogoSrc(canvas.toDataURL("image/png"));
    };
  }, []);

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
  const links = [
    { href: "/catalogo", label: "Catalogo" },
    { href: "/profesionales", label: "Profesionales" },
    { href: "/reservar", label: "Pedir servicio" },
    ...(role === "CUSTOMER" ? [{ href: "/cliente", label: "Panel Cliente" }] : []),
    ...(role === "PRO" ? [{ href: "/pro", label: "Panel Profesional" }] : []),
    ...(role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : [])
  ];

  return (
    <header className="market-nav">
      <Link href="/" className="brand-link">
        <img alt="WeTask" className="brand-logo" src={logoSrc} width={170} height={68} />
      </Link>
      <nav>
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="auth-nav">
        {session?.role ? <span className="auth-badge">{session.fullName ?? "Usuario"} · {session.role}</span> : null}
        {session?.role ? (
          <button type="button" className="nav-link auth-btn" onClick={logout}>
            Salir
          </button>
        ) : (
          <>
            <Link href="/registro?role=CUSTOMER" className="nav-link auth-btn">
              Soy Cliente
            </Link>
            <Link href="/registro?role=PRO" className="nav-link auth-btn">
              Soy Profesional
            </Link>
            <Link href="/ingresar" className="nav-link auth-btn">
              Ingresar
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
