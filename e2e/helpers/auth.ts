import { type Page } from "@playwright/test";

export async function loginAs(
  page: Page,
  role: "customer" | "pro" | "admin",
  credentials?: { email: string; password: string }
) {
  const defaults = {
    customer: { email: "cliente@demo.wetask.cl", password: "demo1234" },
    pro: { email: "tasker@demo.wetask.cl", password: "demo1234" },
    admin: {
      email: process.env.PRIMARY_ADMIN_EMAIL || "admin@wetask.cl",
      password: process.env.PRIMARY_ADMIN_PASSWORD || "admin1234"
    }
  };

  const { email, password } = credentials ?? defaults[role];
  const loginPath = { customer: "/ingresar/cliente", pro: "/ingresar/tasker", admin: "/ingresar/admin" }[role];

  await page.goto(loginPath);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

export async function logout(page: Page) {
  // Borrar cookie de sesión navegando al logout
  await page.goto("/api/auth/logout");
}
