"use client";

import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/catalogo", label: "Catalogo" },
  { href: "/profesionales", label: "Profesionales" },
  { href: "/reservar", label: "Reservar" },
  { href: "/cliente", label: "Panel Cliente" },
  { href: "/pro", label: "Panel Pro" },
  { href: "/admin", label: "Admin" }
];

export function MarketNav() {
  return (
    <header className="market-nav">
      <Link href="/" className="brand-link">
        <Image alt="WeTask" className="brand-logo" src="/logo-wetask-cropped.png" width={170} height={68} priority />
      </Link>
      <nav>
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
