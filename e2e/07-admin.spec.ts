import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.PRIMARY_ADMIN_EMAIL ?? "";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? process.env.PRIMARY_ADMIN_PASSWORD ?? "";
const hasAdmin = Boolean(ADMIN_EMAIL && ADMIN_PASS);

test.describe("Panel admin", () => {
  test("API dashboard-stats sin sesión devuelve 401", async ({ request }) => {
    const res = await request.get("/api/admin/dashboard-stats");
    expect([401, 403]).toContain(res.status());
  });

  test("API onboarding admin sin sesión devuelve 401", async ({ request }) => {
    const res = await request.get("/api/admin/onboarding/cleaning");
    expect([401, 403]).toContain(res.status());
  });

  test("API refund admin sin sesión devuelve 401", async ({ request }) => {
    const res = await request.post("/api/admin/payments/refund", { data: {} });
    expect([401, 403]).toContain(res.status());
  });

  test("admin autenticado ve dashboard con KPIs", async ({ page }) => {
    test.skip(!hasAdmin, "requiere E2E_ADMIN_EMAIL + E2E_ADMIN_PASS");

    await page.goto("/ingresar/admin");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/admin/, { timeout: 15_000 });
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // Debe haber alguna card de KPI
    const kpi = page.locator("[class*='kpi'], [class*='stat'], [class*='card']").first();
    await expect(kpi).toBeVisible({ timeout: 10_000 });
  });

  test("admin autenticado ve cola de onboarding", async ({ page }) => {
    test.skip(!hasAdmin, "requiere credenciales admin E2E");

    await page.goto("/ingresar/admin");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 15_000 });

    await page.goto("/admin/onboarding-limpieza");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("admin autenticado ve panel de disputas", async ({ page }) => {
    test.skip(!hasAdmin, "requiere credenciales admin E2E");

    await page.goto("/ingresar/admin");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 15_000 });

    await page.goto("/admin/disputes");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });
});
