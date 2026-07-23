import { test, expect } from "@playwright/test";

test.describe("Autenticação e Registro", () => {
  test("deve registrar um novo usuário e fazer login com sucesso", async ({ page }) => {
    const uniqueUser = `advogado_${Date.now()}`;
    const testPass = "senha123";

    // 1. Acessa a página de login
    await page.goto("/login");
    await expect(page.locator("h2:has-text('Veredictum')")).toBeVisible();

    // 2. Alterna para o modo de registro
    const registerToggle = page.locator('text=Não tem conta? Cadastrar-se');
    await registerToggle.click();
    await expect(page.locator('button:has-text("Confirmar Cadastro")')).toBeVisible();

    // 3. Preenche as credenciais de cadastro
    await page.fill('input[placeholder="Nome de usuário"]', uniqueUser);
    await page.fill('input[placeholder="Senha secreta"]', testPass);
    await page.click('button:has-text("Confirmar Cadastro")');

    // 4. Aguarda mensagem de sucesso e o redirecionamento automático para modo login
    const successAlert = page.locator("text=Conta criada com sucesso!");
    await expect(successAlert).toBeVisible();

    // 5. O formulário reseta a senha e volta para o modo login. Preenchemos a senha e entramos
    await page.fill('input[placeholder="Nome de usuário"]', uniqueUser);
    await page.fill('input[placeholder="Senha secreta"]', testPass);
    await page.click('button:has-text("Acessar a Conta")');

    // 6. Verifica se fomos redirecionados para a página de clientes
    await page.waitForURL("**/clients");
    
    // 7. Confirma que o perfil está ativo no menu lateral
    const userProfileName = page.locator(`span:has-text('${uniqueUser}')`);
    await expect(userProfileName).toBeVisible();
  });
});
