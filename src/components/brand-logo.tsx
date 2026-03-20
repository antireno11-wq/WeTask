"use client";

import { useEffect, useState } from "react";
import { buildWhiteWordmarkLogo } from "@/lib/logo-processing";

type BrandLogoProps = {
  className?: string;
  width: number;
  height: number;
};

export function BrandLogo({ className, width, height }: BrandLogoProps) {
  const [logoSrc, setLogoSrc] = useState("/logo-wetask.png");

  useEffect(() => {
    buildWhiteWordmarkLogo("/logo-wetask.png", setLogoSrc);
  }, []);

  return <img src={logoSrc} alt="WeTask" className={className} width={width} height={height} />;
}
