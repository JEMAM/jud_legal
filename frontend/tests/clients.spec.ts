import { test, expect } from "@playwright/test";

test.describe("Cadastro de Clientes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("logged_in_user", "test_admin");
    });
  });

  test("deve cadastrar um novo cliente com sucesso e depois excluí-lo", async ({ page }) => {
    // 1. Acessa a página de clientes
    await page.goto("/clients");

    const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
    const uniqueCpf = `123${randomSuffix}09`;
    const uniqueName = `Weslen Queiroz E2E ${randomSuffix}`;

    // 2. Preenche os dados básicos do cliente
    await page.fill('input[placeholder="Nome completo ou Razão"]', uniqueName);
    await page.fill('input[placeholder="000.000.000-00"]', uniqueCpf);
    await page.fill('input[placeholder="exemplo@email.com"]', `weslen.${randomSuffix}@example.com`);
    await page.fill('input[placeholder="(00) 00000-0000"]', "11988888888");

    // 3. Preenche o endereço
    await page.fill('input[placeholder="Rua, Av..."]', "Avenida Paulista");
    await page.fill('input[placeholder="123"]', "1000");
    await page.fill('input[placeholder="Bairro"]', "Bela Vista");
    await page.fill('input[placeholder="Cidade"]', "São Paulo");
    await page.fill('input[placeholder="SP"]', "SP");

    // 4. Submete o formulário
    await page.click('button[type="submit"]:has-text("Cadastrar Cliente")');

    // 5. Verifica se a notificação de sucesso aparece ou se o cliente foi listado
    const successToast = page.locator("text=Cliente cadastrado com sucesso!");
    await expect(successToast).toBeVisible({ timeout: 5000 });
    
    // 6. Confirma que o cliente aparece na lista de clientes cadastrados
    const clientCardName = page.locator(`h4:has-text("${uniqueName}")`);
    await expect(clientCardName).toBeVisible({ timeout: 5000 });

    // 7. Limpeza: Exclui o cliente cadastrado para manter o banco de dados limpo
    const clientCard = page.locator(`div.bg-slate-900:has(h4:has-text("${uniqueName}"))`);
    const deleteBtn = clientCard.locator('button[title="Excluir"]');
    
    // Configura o handler de diálogo para confirmar a exclusão
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    
    await deleteBtn.click();

    // Confirma que o cliente não está mais visível
    await expect(clientCardName).not.toBeVisible({ timeout: 5000 });
  });
});
