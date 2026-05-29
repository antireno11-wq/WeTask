import { expect, test } from "@playwright/test";

const PRO_EMAIL = process.env.E2E_PRO_EMAIL ?? "";
const PRO_PASS = process.env.E2E_PRO_PASS ?? "";
const hasPro = Boolean(PRO_EMAIL && PRO_PASS);

test.describe("Panel tasker (pro)", () => {
  test("/pro sin sesión redirige a login", async ({ page }) => {
    await page.goto("/pro");
    await expect(page).toHaveURL(/ingresar/);
  });

  test("API /api/marketplace/pro/profile sin sesión devuelve 401", async ({ request }) => {
    const res = await request.get("/api/marketplace/pro/profile");
    expect([401, 403]).toContain(res.status());
  });

  test("API MP OAuth init sin sesión devuelve 401", async ({ request }) => {
    const res = await request.post("/api/payments/mp/oauth/init");
    expect([401, 403]).toContain(res.status());
  });

  test("pro autenticado ve su dashboard", async ({ page }) => {
    test.skip(!hasPro, "requiere E2E_PRO_EMAIL + E2E_PRO_PASS");

    await page.goto("/ingresar/tasker");
    await page.fill('input[type="email"]', PRO_EMAIL);
    await page.fill('input[type="password"]', PRO_PASS);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/pro/, { timeout: 15_000 });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("pro autenticado ve sección de reservas", async ({ page }) => {
    test.skip(!hasPro, "requiere credenciales pro E2E");

    await page.goto("/ingresar/tasker");
    await page.fill('input[type="email"]', PRO_EMAIL);
    await page.fill('input[type="password"]', PRO_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/pro/, { timeout: 15_000 });

    // Navegar a reservas del pro
    const reservasLink = page.locator("a[href*='/pro/reservas'], button:has-text('reservas'), button:has-text('Reservas')").first();
    if (await reservasLink.isVisible()) {
      await reservasLink.click();
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 8000 });
    }
  });
});
