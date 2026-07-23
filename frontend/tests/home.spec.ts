import { test, expect } from "@playwright/test";

test.describe("Página Inicial / Abertura", () => {
  test("deve renderizar a landing page de abertura com links de acesso", async ({ page }) => {
    // 1. Acessa a raiz
    await page.goto("/");

    // 2. Verifica se a hero headline renderizou
    const heroTitle = page.locator("h1:has-text('Inteligência Processual')");
    await expect(heroTitle).toBeVisible();

    // 3. Verifica se o link de login principal está presente
    const linkLogin = page.locator("text=Acessar a Conta");
    await expect(linkLogin).toBeVisible();
  });
});
