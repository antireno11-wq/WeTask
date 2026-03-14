"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/services", label: "Servicios" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/trabaja-con-nosotros", label: "Ofrecer servicios" }
];

export function AuthHeroNav() {
  return (
    <header className="auth-hero-nav">
      <Link href="/" className="auth-hero-brand" aria-label="Volver al inicio de WeTask">
        <BrandLogo width={180} height={60} />
      </Link>

      <nav className="auth-hero-links" aria-label="Navegacion principal">
        {navLinks.map((item) => (
          <Link key={item.href} href={item.href} className="auth-hero-link">
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="auth-hero-actions">
        <Link href="/ingresar" className="auth-hero-link">
          Acceder
        </Link>
        <Link href="/registro" className="auth-hero-link auth-hero-link-strong">
          Crear cuenta
        </Link>
      </div>
    </header>
  );
}
