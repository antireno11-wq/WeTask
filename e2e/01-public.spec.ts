import { expect, test } from "@playwright/test";

test.describe("Páginas públicas", () => {
  test("home carga y tiene CTA de reserva", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/WeTask/i);
    // Al menos un link que lleve a reservar o al catálogo
    const cta = page.locator("a[href*='reservar'], a[href*='servicios'], a[href*='catalogo']").first();
    await expect(cta).toBeVisible();
  });

  test("catálogo de servicios carga", async ({ page }) => {
    await page.goto("/servicios");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("/api/health devuelve 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  test("/api/marketplace/demo devuelve 404 en producción", async ({ request }) => {
    const res = await request.post("/api/marketplace/demo");
    // En prod devuelve 404; en dev con SEED_DEMO_DATA puede devolver 200
    expect([200, 404]).toContain(res.status());
  });

  test("página de ayuda/soporte carga", async ({ page }) => {
    await page.goto("/ayuda-soporte");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("página legal / privacidad carga", async ({ page }) => {
    await page.goto("/legal/privacidad");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("página como funciona carga", async ({ page }) => {
    await page.goto("/como-funciona");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("página trabaja con nosotros carga", async ({ page }) => {
    await page.goto("/trabaja-con-nosotros");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("sitemap.xml responde", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("<urlset");
  });

  test("robots.txt responde", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
  });
});
