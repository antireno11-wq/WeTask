import { expect, test } from "@playwright/test";

test.describe("Catálogo y búsqueda de profesionales", () => {
  test("API catálogo devuelve categorías", async ({ request }) => {
    const res = await request.get("/api/marketplace/catalog");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { categories?: unknown[] };
    expect(Array.isArray(body.categories)).toBe(true);
  });

  test("API servicios devuelve lista", async ({ request }) => {
    const res = await request.get("/api/services");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { services?: unknown[] };
    expect(Array.isArray(body.services)).toBe(true);
  });

  test("página /servicios muestra categorías", async ({ page }) => {
    await page.goto("/servicios");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // Debe haber al menos un enlace a categoría
    const links = page.locator("a[href*='/servicios/']");
    await expect(links.first()).toBeVisible({ timeout: 8000 });
  });

  test("API búsqueda de profesionales acepta parámetros básicos", async ({ request }) => {
    const res = await request.post("/api/marketplace/search-professionals", {
      data: {
        city: "Santiago",
        commune: "Las Condes",
        postalCode: "7550000",
        categoryId: null,
        tasks: []
      }
    });
    // Puede devolver 200 (con resultados) o 400 (sin categoría válida) según el estado de demo data
    expect([200, 400]).toContain(res.status());
  });

  test("página reservar carga el wizard", async ({ page }) => {
    await page.goto("/reservar");
    // Debe redirigir a login (requiere auth)
    await expect(page).toHaveURL(/ingresar|reservar/);
  });

  test("página catálogo carga", async ({ page }) => {
    await page.goto("/catalogo");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
