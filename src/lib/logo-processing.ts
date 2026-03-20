export function buildWhiteWordmarkLogo(src: string, onReady: (dataUrl: string) => void) {
  const img = new window.Image();
  img.src = src;
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
    const bottomLeft = [pixels[bottomLeftIndex], pixels[bottomLeftIndex + 1], pixels[bottomLeftIndex + 2]];
    const bottomRightIndex = (canvas.width * canvas.height - 1) * 4;
    const bottomRight = [pixels[bottomRightIndex], pixels[bottomRightIndex + 1], pixels[bottomRightIndex + 2]];

    const matte = [
      Math.round((topLeft[0] + topRight[0] + bottomLeft[0] + bottomRight[0]) / 4),
      Math.round((topLeft[1] + topRight[1] + bottomLeft[1] + bottomRight[1]) / 4),
      Math.round((topLeft[2] + topRight[2] + bottomLeft[2] + bottomRight[2]) / 4)
    ];

    const textStartX = canvas.width * 0.28;

    for (let i = 0; i < pixels.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % canvas.width;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      const dr = r - matte[0];
      const dg = g - matte[1];
      const db = b - matte[2];
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);

      if (distance < 26) {
        pixels[i + 3] = 0;
        continue;
      }

      if (distance < 45) {
        pixels[i + 3] = Math.min(pixels[i + 3], 72);
      }

      const isBlueWordmarkPixel = x >= textStartX && b >= r + 12 && g >= r - 6;
      if (isBlueWordmarkPixel && pixels[i + 3] > 0) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
      }
    }

    ctx.putImageData(frame, 0, 0);
    onReady(canvas.toDataURL("image/png"));
  };
}
