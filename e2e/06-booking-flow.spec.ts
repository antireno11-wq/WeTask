import { expect, test } from "@playwright/test";

/**
 * Tests del flujo de reserva. No requieren sesión para los checks de API básicos.
 * Los checks que necesitan auth se marcan skip si no hay credenciales configuradas.
 */

const DEMO_CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? "";
const DEMO_CUSTOMER_PASS = process.env.E2E_CUSTOMER_PASS ?? "";
const hasCredentials = Boolean(DEMO_CUSTOMER_EMAIL && DEMO_CUSTOMER_PASS);

test.describe("Flujo de reserva", () => {
  test("API checkout sin sesión devuelve 401/403", async ({ request }) => {
    const res = await request.post("/api/bookings/checkout", {
      data: {
        customerId: "fake",
        serviceId: "fake",
        startsAt: new Date().toISOString(),
        hours: 2,
        address: { street: "Test 123", commune: "Las Condes", city: "Santiago", postalCode: "7550000" },
        payment: { payerEmail: "test@test.cl", installments: 1 }
      }
    });
    expect([401, 403]).toContain(res.status());
  });

  test("API slot-hold sin sesión devuelve 401/403", async ({ request }) => {
    const res = await request.post("/api/bookings/slot-hold", {
      data: { slotId: "fake-slot-id" }
    });
    expect([401, 403]).toContain(res.status());
  });

  test("API notificaciones sin sesión devuelve 401", async ({ request }) => {
    const res = await request.get("/api/marketplace/notifications");
    expect([401, 403]).toContain(res.status());
  });

  test.skip(!hasCredentials, "requiere E2E_CUSTOMER_EMAIL + E2E_CUSTOMER_PASS");

  test("cliente autenticado ve su dashboard", async ({ page }) => {
    test.skip(!hasCredentials, "requiere credenciales E2E");

    await page.goto("/ingresar/cliente");
    await page.fill('input[type="email"]', DEMO_CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', DEMO_CUSTOMER_PASS);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/cliente/, { timeout: 15_000 });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("cliente autenticado accede al wizard de reserva", async ({ page }) => {
    test.skip(!hasCredentials, "requiere credenciales E2E");

    await page.goto("/ingresar/cliente");
    await page.fill('input[type="email"]', DEMO_CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', DEMO_CUSTOMER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/cliente/, { timeout: 15_000 });

    await page.goto("/reservar");
    await expect(page).toHaveURL(/reservar/);
    // Step 1: formulario de dirección + servicio
    await expect(page.locator("form, input").first()).toBeVisible({ timeout: 10_000 });
  });
});
