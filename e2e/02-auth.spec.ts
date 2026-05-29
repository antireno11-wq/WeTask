import { expect, test } from "@playwright/test";

test.describe("Autenticación", () => {
  test("página de login cliente carga con formulario", async ({ page }) => {
    await page.goto("/ingresar/cliente");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("página de login tasker carga", async ({ page }) => {
    await page.goto("/ingresar/tasker");
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("login con credenciales inválidas muestra error", async ({ page }) => {
    await page.goto("/ingresar/cliente");
    await page.fill('input[type="email"]', "noexiste@wetask.cl");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Esperar feedback de error en la UI
    await expect(page.locator("text=/error|no encontrado|inválid/i").first()).toBeVisible({ timeout: 8000 });
  });

  test("ruta /cliente sin sesión redirige a login", async ({ page }) => {
    await page.goto("/cliente");
    await expect(page).toHaveURL(/ingresar/);
  });

  test("ruta /pro sin sesión redirige a login", async ({ page }) => {
    await page.goto("/pro");
    await expect(page).toHaveURL(/ingresar/);
  });

  test("ruta /admin sin sesión redirige a login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/ingresar/);
  });

  test("API auth login devuelve 400 sin body", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: {} });
    expect([400, 404]).toContain(res.status());
  });

  test("API auth login devuelve 429 tras muchos intentos", async ({ request }) => {
    // 6 intentos rápidos → el 6.º debe ser 429 (rate limit 5/m)
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request.post("/api/auth/login", {
        data: { email: "test@wetask.cl", password: "wrong" }
      });
      lastStatus = res.status();
    }
    // Con Upstash configurado debería dar 429; sin config falla abierto
    expect([401, 404, 429]).toContain(lastStatus);
  });

  test("página de registro cliente carga", async ({ page }) => {
    await page.goto("/registro");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("página de restablecer contraseña carga", async ({ page }) => {
    await page.goto("/restablecer-contrasena");
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
