/**
 * Confetti minimalista en canvas — sin dependencias. Llamar desde el cliente
 * después de un evento de éxito (e.g. checkout confirmado). Auto-cleanup
 * tras ~2.2s.
 */
export function fireConfetti(options?: { particles?: number; durationMs?: number }) {
  if (typeof window === "undefined") return;
  const particles = options?.particles ?? 120;
  const duration = options?.durationMs ?? 2200;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const colors = ["#18a6d5", "#76f2c0", "#ff6a00", "#173e73", "#1d7fc6", "#ffffff"];
  const items = Array.from({ length: particles }).map(() => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 60,
    y: canvas.height / 3,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 8,
    size: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3
  }));

  const start = performance.now();
  let raf = 0;

  const tick = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    items.forEach((p) => {
      p.vy += 0.35; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    if (elapsed < duration) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  };
  raf = requestAnimationFrame(tick);
}
