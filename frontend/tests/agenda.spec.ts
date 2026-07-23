import { test, expect } from "@playwright/test";

test.describe("Agenda de Prazos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("logged_in_user", "test_admin");
    });
  });

  test("deve renderizar a agenda de prazos e interagir com as visualizações", async ({ page }) => {
    // 1. Acessa a agenda
    await page.goto("/agenda");

    // 2. Verifica se a interface básica renderizou
    const agendaTitle = page.locator("h2:has-text('Agenda de Prazos')");
    await expect(agendaTitle).toBeVisible();

    // 3. Verifica se as visualizações estão disponíveis e clica nelas
    const dayBtn = page.locator('button:has-text("Dia / Horas")');
    const monthBtn = page.locator('button:has-text("Mês")');
    const yearBtn = page.locator('button:has-text("Ano")');
    
    await expect(dayBtn).toBeVisible();
    await expect(monthBtn).toBeVisible();
    await expect(yearBtn).toBeVisible();

    // Alterna para visualização por Dia
    await dayBtn.click();
    await expect(page.locator("text=Quadro Horário do Dia")).toBeVisible();

    // Alterna para visualização por Ano
    await yearBtn.click();
    await expect(page.locator("text=Janeiro")).toBeVisible();

    // Volta para visualização por Mês
    await monthBtn.click();
    await expect(page.locator("text=Seg")).toBeVisible();
  });
});
