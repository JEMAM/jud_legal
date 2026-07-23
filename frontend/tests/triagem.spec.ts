import { test, expect } from "@playwright/test";

test.describe("Painel de Triagem & DJE", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("logged_in_user", "test_admin");
    });
  });

  test("deve renderizar a interface de busca e preencher os parâmetros", async ({ page }) => {
    // 1. Acessa a página de triagem
    await page.goto("/triagem");

    // 2. Confirma os elementos principais do painel de busca
    const searchHeader = page.locator("text=Parâmetros de Varredura (PJe)");
    await expect(searchHeader).toBeVisible();

    // 3. Preenche número de processo de teste
    await page.fill('input[placeholder="Ex: 150025498..."]', "15002549820188260540");

    // 4. Seleciona o Tribunal
    await page.selectOption("select >> nth=0", { label: "TJSP" });

    // 5. Clica no botão de busca
    await page.click('button:has-text("Executar Pesquisa Avançada")');

    // 6. Verifica se o status do carregamento ou os cabeçalhos da tabela são exibidos
    const tableHeader = page.locator("text=Registros Extraídos do Diário de Justiça");
    await expect(tableHeader).toBeVisible();
  });
});
