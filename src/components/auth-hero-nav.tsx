"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const primaryLinks = [
  { href: "/", label: "Inicio" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/services", label: "Servicios" }
];

const accountLinks = [
  { href: "/trabaja-con-nosotros", label: "Soy tasker" },
  { href: "/registro", label: "Soy cliente" }
];

export function AuthHeroNav() {
  return (
    <header className="auth-hero-nav">
      <Link href="/" className="auth-hero-brand" aria-label="Volver al inicio de WeTask">
        <BrandLogo width={180} height={60} />
      </Link>

      <div className="auth-hero-nav-groups">
        <nav className="auth-hero-links" aria-label="Navegación principal">
          {primaryLinks.map((item) => (
            <Link key={item.href} href={item.href} className="auth-hero-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="auth-hero-links auth-hero-links-secondary">
          {accountLinks.map((item) => (
            <Link key={item.href} href={item.href} className="auth-hero-link auth-hero-link-strong">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="auth-hero-actions">
          <Link href="/ingresar" className="auth-hero-link">
            Acceder
          </Link>
        </div>
      </div>
    </header>
  );
}
