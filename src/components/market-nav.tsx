"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function MarketNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [logoSrc, setLogoSrc] = useState("/logo-wetask.png");
  const [session, setSession] = useState<{ fullName?: string | null; role?: string | null } | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/logo-wetask.png";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = frame.data;

      // Remove the matte background by comparing against the average corner color.
      const topLeft = [pixels[0], pixels[1], pixels[2]];
      const topRight = [pixels[(canvas.width - 1) * 4], pixels[(canvas.width - 1) * 4 + 1], pixels[(canvas.width - 1) * 4 + 2]];
      const bottomLeftIndex = (canvas.width * (canvas.height - 1)) * 4;
      const bottomLeft = [pixels[bottomLeftIndex], pixels[bottomLeftIndex + 1], pixels[bottomLeftIndex + 2]];
      const bottomRightIndex = (canvas.width * canvas.height - 1) * 4;
      const bottomRight = [pixels[bottomRightIndex], pixels[bottomRightIndex + 1], pixels[bottomRightIndex + 2]];

      const matte = [
        Math.round((topLeft[0] + topRight[0] + bottomLeft[0] + bottomRight[0]) / 4),
        Math.round((topLeft[1] + topRight[1] + bottomLeft[1] + bottomRight[1]) / 4),
        Math.round((topLeft[2] + topRight[2] + bottomLeft[2] + bottomRight[2]) / 4)
      ];

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const dr = r - matte[0];
        const dg = g - matte[1];
        const db = b - matte[2];
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);

        if (distance < 26) {
          pixels[i + 3] = 0;
        } else if (distance < 45) {
          pixels[i + 3] = Math.min(pixels[i + 3], 72);
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
  const accountHref = role === "PRO" ? "/pro" : role === "ADMIN" ? "/admin" : "/cliente";
  const links = [
    { href: "/services", label: "Servicios" },
    { href: "/profesionales", label: "Profesionales" },
    { href: "/sobre-nosotros", label: "Sobre nosotros" }
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
            <Link href="/registro?role=PRO" className="nav-link auth-btn">
              Ofrecer servicios
            </Link>
            <Link href="/ingresar" className="nav-link auth-btn auth-login-pill">
              Acceder
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
