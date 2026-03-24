"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";

type HomeServiceLinkProps = {
  categorySlug: string;
  source: string;
  className?: string;
  children: ReactNode;
};

export function HomeServiceLink({ categorySlug, source, className, children }: HomeServiceLinkProps) {
  const [hasSession, setHasSession] = useState(false);
  const [savedAddress, setSavedAddress] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { userId?: string | null } | null };
        setHasSession(Boolean(data.session?.userId));
      } catch {
        setHasSession(false);
      }

      try {
        const address = window.localStorage.getItem("wetask_customer_address")?.trim() ?? "";
        setSavedAddress(address);
      } catch {
        setSavedAddress("");
      }
    };

    void load();
  }, []);

  const href = useMemo(() => {
    const serviceUrl = new URLSearchParams();
    serviceUrl.set("source", source);
    if (savedAddress) {
      serviceUrl.set("address", savedAddress);
      serviceUrl.set("skipAddress", "1");
    }

    const nextServiceHref = `/servicios/${categorySlug}${serviceUrl.toString() ? `?${serviceUrl.toString()}` : ""}`;
    if (hasSession) return nextServiceHref;
    return `/ingresar/cliente?next=${encodeURIComponent(nextServiceHref)}`;
  }, [categorySlug, hasSession, savedAddress, source]);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
