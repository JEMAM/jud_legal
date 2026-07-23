import { test, expect } from "@playwright/test";

test.describe("Kanban de Processos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("logged_in_user", "test_admin");
    });
  });

  test("deve gerenciar processos no quadro Kanban", async ({ page }) => {
    // 1. Acessa o Kanban
    await page.goto("/kanban");

    // 2. Verifica se a interface básica renderizou
    const kanbanTitle = page.locator("h2:has-text('Kanban de Processos')");
    await expect(kanbanTitle).toBeVisible();

    // 3. Abre o dropdown de seleção de processos
    const dropdownBtn = page.locator('button:has-text("processo(s) selecionado(s)"), button:has-text("Selecione processos...")');
    await dropdownBtn.click();
    await dropdownBtn.click(); // Close it

    // 4. Edita um processo se houver algum card no quadro
    const editBtn = page.locator('button[title="Editar"]').first();
    const count = await editBtn.count();
    
    if (count > 0) {
      await editBtn.click();
      
      // Preenche os campos do processo no modal
      const uniqueSummary = `Resumo de teste E2E ${Math.floor(1000 + Math.random() * 9000)}`;
      await page.fill('textarea[placeholder="Insira um pequeno resumo ou os prazos pendentes deste processo..."]', uniqueSummary);
      
      // Clica em salvar
      await page.click('button:has-text("Salvar Alterações")');
      
      // Verifica se o texto do resumo atualizado aparece no card
      const summaryText = page.locator(`p:has-text("${uniqueSummary}")`);
      await expect(summaryText).toBeVisible({ timeout: 5000 });
    }
  });
});
