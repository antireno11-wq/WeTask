"use client";

import { useEffect, useState } from "react";
import { buildTransparentLogo, buildWhiteLogo } from "@/lib/logo-processing";

let cachedTransparentLogoSrc: string | null = null;
let cachedWhiteLogoSrc: string | null = null;

type BrandLogoProps = {
  className?: string;
  width: number;
  height: number;
  variant?: "default" | "white-wordmark";
};

export function BrandLogo({ className, width, height, variant = "default" }: BrandLogoProps) {
  const [baseLogoSrc, setBaseLogoSrc] = useState<string | null>(cachedTransparentLogoSrc);
  const [whiteLogoSrc, setWhiteLogoSrc] = useState<string | null>(variant === "white-wordmark" ? cachedWhiteLogoSrc : null);

  useEffect(() => {
    if (cachedTransparentLogoSrc) {
      setBaseLogoSrc(cachedTransparentLogoSrc);
    } else {
      buildTransparentLogo("/logo-wetask.png", (dataUrl) => {
        cachedTransparentLogoSrc = dataUrl;
        setBaseLogoSrc(dataUrl);
      });
    }

    if (variant === "white-wordmark") {
      if (cachedWhiteLogoSrc) {
        setWhiteLogoSrc(cachedWhiteLogoSrc);
      } else {
        buildWhiteLogo("/logo-wetask.png", (dataUrl) => {
          cachedWhiteLogoSrc = dataUrl;
          setWhiteLogoSrc(dataUrl);
        });
      }
    }
  }, [variant]);

  const placeholder = (
    <span
      className={className}
      style={{ width, height, maxWidth: "100%", display: "inline-block", background: "transparent", flexShrink: 0 }}
      aria-hidden
    />
  );

  if (variant !== "white-wordmark") {
    if (!baseLogoSrc) return placeholder;
    return <img src={baseLogoSrc} alt="WeTask" className={className} width={width} height={height} />;
  }

  if (!baseLogoSrc || !whiteLogoSrc) {
    return placeholder;
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
