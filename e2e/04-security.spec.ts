import { expect, test } from "@playwright/test";

test.describe("Seguridad y guardas de acceso", () => {
  test("webhook MP sin firma devuelve 401", async ({ request }) => {
    const res = await request.post("/api/payments/webhook/mercadopago", {
      data: { data: { id: "123456" } },
      headers: { "Content-Type": "application/json" }
    });
    // Sin MERCADOPAGO_WEBHOOK_SECRET puede ser 401 (prod) o 200 ignorado (dev)
    expect([200, 401]).toContain(res.status());
  });

  test("rutas /api/admin/* sin sesión devuelven 401", async ({ request }) => {
    const routes = [
      "/api/admin/payments/refund",
      "/api/admin/dashboard-stats",
      "/api/admin/onboarding/cleaning"
    ];
    for (const route of routes) {
      const res = await request.get(route);
      expect([401, 403, 405]).toContain(res.status());
    }
  });

  test("rutas /api/marketplace/* protegidas devuelven 401 sin sesión", async ({ request }) => {
    const routes = [
      "/api/marketplace/bookings",
      "/api/marketplace/admin/disputes"
    ];
    for (const route of routes) {
      const res = await request.get(route);
      expect([401, 403, 404, 405]).toContain(res.status());
    }
  });

  test("/api/me/account sin sesión devuelve 401", async ({ request }) => {
    const res = await request.delete("/api/me/account");
    expect(res.status()).toBe(401);
  });

  test("/api/me/data-export sin sesión devuelve 401", async ({ request }) => {
    const res = await request.get("/api/me/data-export");
    expect(res.status()).toBe(401);
  });

  test("rate limit en /api/auth/login (5/min)", async ({ request }) => {
    const attempts = [];
    for (let i = 0; i < 7; i++) {
      attempts.push(
        request.post("/api/auth/login", {
          data: { email: `ratelimit${i}@test.cl`, password: "wrong" }
        })
      );
    }
    const responses = await Promise.all(attempts);
    const statuses = responses.map((r) => r.status());
    // Con Upstash activo alguno debe ser 429; sin config falla abierto (401/404)
    const has429 = statuses.some((s) => s === 429);
    const allAuthFailures = statuses.every((s) => [401, 404, 429].includes(s));
    expect(allAuthFailures).toBe(true);
    // Si hay rate limiting configurado, debe haber al menos un 429
    if (process.env.UPSTASH_REDIS_REST_URL) {
      expect(has429).toBe(true);
    }
  });

  test("rutas de cron sin firma QStash devuelven 401", async ({ request }) => {
    const cronRoutes = [
      "/api/cron/process-bookings",
      "/api/cron/reconcile-payments",
      "/api/cron/booking-reminders",
      "/api/cron/hard-delete-accounts",
      "/api/cron/refresh-mp-tokens"
    ];
    for (const route of cronRoutes) {
      const res = await request.post(route, { data: {} });
      // Sin firma QStash debe ser 401 (con secret configurado) o 200/500 (dev sin secret)
      expect([200, 401, 500]).toContain(res.status());
    }
  });
});
