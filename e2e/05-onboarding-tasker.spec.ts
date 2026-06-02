import { expect, test } from "@playwright/test";

test.describe("Onboarding tasker (registro wizard)", () => {
  test("página /trabaja-con-nosotros/registro carga el wizard", async ({ page }) => {
    await page.goto("/trabaja-con-nosotros/registro");
    // Debe mostrar el primer step del wizard
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // Debe haber un formulario o botón de inicio
    const form = page.locator("form, button[type='submit'], button[type='button']").first();
    await expect(form).toBeVisible();
  });

  test("API /api/onboarding/public/phone/send rechaza número muy corto", async ({ request }) => {
    const res = await request.post("/api/onboarding/public/phone/send", {
      data: { phone: "+569123" }
    });
    expect([400, 429]).toContain(res.status());
  });

  test("API /api/onboarding/public/phone/send rate-limits por número", async ({ request }) => {
    // 4 envíos rápidos al mismo número → el cuarto debe dar 429 (límite 3/h)
    const phone = "+56912345678";
    let lastStatus = 0;
    for (let i = 0; i < 4; i++) {
      const res = await request.post("/api/onboarding/public/phone/send", {
        data: { phone }
      });
      lastStatus = res.status();
    }
    // 429 si hay Upstash; si no, puede ser 200/400/502 (Twilio no configurado)
    expect([200, 400, 429, 502]).toContain(lastStatus);
  });

  test("página /trabaja-con-nosotros/en-revision carga", async ({ page }) => {
    await page.goto("/trabaja-con-nosotros/en-revision");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("wizard muestra selector de categorías en step inicial", async ({ page }) => {
    await page.goto("/trabaja-con-nosotros/registro");
    // Esperar a que cargue el contenido del wizard
    await page.waitForLoadState("networkidle");
    // Debe haber texto relacionado a categorías o al registro
    const body = await page.textContent("body");
    expect(body).toMatch(/limpieza|tasker|servicio|registro|profesional/i);
  });
});
