"use client";

import { useEffect, useState } from "react";
import { buildTransparentLogo, buildWhiteLogo } from "@/lib/logo-processing";

type BrandLogoProps = {
  className?: string;
  width: number;
  height: number;
  variant?: "default" | "white-wordmark";
};

export function BrandLogo({ className, width, height, variant = "default" }: BrandLogoProps) {
  const [baseLogoSrc, setBaseLogoSrc] = useState("/logo-wetask.png");
  const [whiteLogoSrc, setWhiteLogoSrc] = useState("/logo-wetask.png");

  useEffect(() => {
    buildTransparentLogo("/logo-wetask.png", setBaseLogoSrc);
    if (variant === "white-wordmark") {
      buildWhiteLogo("/logo-wetask.png", setWhiteLogoSrc);
    }
  }, [variant]);

  if (variant !== "white-wordmark") {
    return <img src={baseLogoSrc} alt="WeTask" className={className} width={width} height={height} />;
  }

  return (
    <span
      className={`brand-logo-composite ${className ?? ""}`.trim()}
      style={{ width, maxWidth: "100%" }}
      aria-label="WeTask"
      role="img"
    >
      <img src={baseLogoSrc} alt="" className="brand-logo-layer brand-logo-layer-base" width={width} height={height} aria-hidden />
      <span className="brand-logo-wordmark-mask" aria-hidden>
        <img src={whiteLogoSrc} alt="" className="brand-logo-layer brand-logo-layer-wordmark" width={width} height={height} />
      </span>
    </span>
  );
}
