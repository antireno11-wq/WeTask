"use client";

import { useEffect, useState } from "react";

type BrandLogoProps = {
  className?: string;
  width: number;
  height: number;
};

export function BrandLogo({ className, width, height }: BrandLogoProps) {
  const [logoSrc, setLogoSrc] = useState("/logo-wetask.png");

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

      const topLeft = [pixels[0], pixels[1], pixels[2]];
      const topRight = [pixels[(canvas.width - 1) * 4], pixels[(canvas.width - 1) * 4 + 1], pixels[(canvas.width - 1) * 4 + 2]];
      const bottomLeftIndex = canvas.width * (canvas.height - 1) * 4;
      const topBottomLeft = [pixels[bottomLeftIndex], pixels[bottomLeftIndex + 1], pixels[bottomLeftIndex + 2]];
      const bottomRightIndex = (canvas.width * canvas.height - 1) * 4;
      const bottomRight = [pixels[bottomRightIndex], pixels[bottomRightIndex + 1], pixels[bottomRightIndex + 2]];

      const matte = [
        Math.round((topLeft[0] + topRight[0] + topBottomLeft[0] + bottomRight[0]) / 4),
        Math.round((topLeft[1] + topRight[1] + topBottomLeft[1] + bottomRight[1]) / 4),
        Math.round((topLeft[2] + topRight[2] + topBottomLeft[2] + bottomRight[2]) / 4)
      ];

      for (let i = 0; i < pixels.length; i += 4) {
        const dr = pixels[i] - matte[0];
        const dg = pixels[i + 1] - matte[1];
        const db = pixels[i + 2] - matte[2];
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

  return <img src={logoSrc} alt="WeTask" className={className} width={width} height={height} />;
}
