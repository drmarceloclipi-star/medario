import { expect, test } from "@playwright/test";

import { hasHorizontalOverflow, MOBILE_VIEWPORTS } from "../quality/mobile";

async function openShell(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

test.describe("mobile shell", () => {
  test("opens and closes the drawer", async ({ page }) => {
    await openShell(page);

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeHidden();
  });

  test("opens and closes the filter bottom sheet", async ({ page }) => {
    await openShell(page);

    await page.getByRole("button", { name: "Adicionar filtros" }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros da busca" });
    await expect(sheet).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(sheet).toBeHidden();
  });

  test("does not persist symptom search after consent refusal and shares derived filters only", async ({ page }) => {
    await openShell(page);

    await page.getByLabel("Descreva o que você precisa").fill("Tenho ansiedade, psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("dialog", { name: "Dados de saúde nesta busca" })).toBeVisible();
    await page.getByRole("button", { name: "Continuar sem consentimento" }).click();

    await expect(page).toHaveURL(/specialty=psiquiatria/);
    await expect(page).toHaveURL(/city=joinville/);
    expect(page.url()).not.toContain("ansiedade");
    await page.getByLabel("Descreva o que você precisa").focus();
    await expect(page.getByText("Tenho ansiedade, psiquiatra em Joinville")).toHaveCount(0);
  });

  test("asks contextual consent before retaining a symptom search", async ({ page }) => {
    await openShell(page);

    await page.getByLabel("Descreva o que você precisa").fill("Ansiedade e psiquiatra");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Permitir e continuar" }).click();
    await page.getByLabel("Descreva o que você precisa").focus();

    await expect(page.getByRole("button", { name: /Ansiedade e psiquiatra/ })).toBeVisible();
  });

  test("shows factual results, separated sponsorship and accessible pagination", async ({ page }) => {
    await openShell(page);

    await page.getByLabel("Descreva o que você precisa").fill("Psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("heading", { name: "Dra. Marina Alves" })).toBeVisible();
    await expect(page.getByText("Ordem orgânica")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Patrocinados" })).toBeVisible();
    await expect(page.getByText(/km/)).toHaveCount(0);

    await page.getByRole("button", { name: "Carregar mais resultados" }).click();
    await expect(page.getByRole("heading", { name: "Dr. Rafael Nunes" })).toBeVisible();
  });

  test("shows the migrated public profile without moving the legacy site", async ({ page }) => {
    await page.goto("/medicos/dra-marina-alves");
    await expect(page).toHaveURL(/\/medicos\/mariana-andrade$/);
    await expect(page.getByRole("heading", { name: "Dra. Mariana Andrade" })).toBeVisible();
    await expect(page.getByText("Dados atualizados em")).toBeVisible();
    await expect(page.getByRole("link", { name: "WhatsApp verificado" })).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://medario.com.br/medicos/mariana-andrade");
  });

  test("interrupts urgent symptom reports without creating a search URL", async ({ page }) => {
    await openShell(page);
    await page.getByLabel("Descreva o que você precisa").fill("Estou com dor no peito e falta de ar");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.locator(".urgent-guidance")).toContainText("Busque atendimento imediato");
    expect(page.url()).not.toContain("dor");
  });

  test("keeps map and list synchronized while map failure preserves results", async ({ page }) => {
    await openShell(page);
    await page.getByLabel("Descreva o que você precisa").fill("Psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("button", { name: /2 local/ })).toBeVisible();
    await page.getByRole("button", { name: /2 local/ }).click();
    await expect(page.locator(".result-card.selected")).toContainText("Dra. Marina Alves");
    await expect(page.getByRole("link", { name: "Rota no Google Maps" }).first()).toHaveAttribute("href", /google\.com\/maps/);
    await page.getByRole("button", { name: "Mapa indisponível" }).click();
    await expect(page.getByText("Use a lista e os filtros para continuar sua busca.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dra. Marina Alves" })).toBeVisible();
  });

  test("lets a visitor save a search and favorite locally without an account", async ({ page }) => {
    await openShell(page);
    await page.getByLabel("Descreva o que você precisa").fill("Psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Salvar busca" }).click();
    await expect(page.getByText("Busca salva neste dispositivo.")).toBeVisible();
    const savedSearches = page.getByRole("complementary", { name: "Buscas salvas neste dispositivo" });
    await expect(savedSearches).toContainText("psiquiatria");
    await savedSearches.getByRole("button", { name: "Remover busca salva" }).click();
    await expect(savedSearches).toBeHidden();
    await page.getByRole("button", { name: "Favoritar" }).first().click();
    await expect(page.getByRole("button", { name: "Remover favorito" }).first()).toBeVisible();
  });

  test("compares at most three doctors using explicit criteria and lets the user remove one", async ({ page }) => {
    await openShell(page);
    await page.getByLabel("Descreva o que você precisa").fill("Psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();

    await page.getByRole("button", { name: "Comparar" }).nth(0).click();
    await page.getByRole("button", { name: "Comparar" }).nth(0).click();
    await page.getByRole("button", { name: "Carregar mais resultados" }).click();
    await page.getByRole("button", { name: "Comparar" }).click();

    const comparison = page.getByRole("region", { name: "Comparação de médicos" });
    await expect(comparison.getByRole("heading", { name: "3 de 3 médicos" })).toBeVisible();
    await expect(comparison.getByRole("button", { name: "Remover" })).toHaveCount(3);

    await comparison.getByLabel("Convênio").check();
    await comparison.getByLabel("Disponibilidade").check();
    await expect(comparison.getByText("Compatível com 2 de 2 critérios escolhidos.").first()).toBeVisible();

    const marina = comparison.getByRole("article").filter({ has: page.getByRole("heading", { name: "Dra. Marina Alves" }) });
    await marina.getByRole("button", { name: "Remover" }).click();
    await expect(comparison.getByRole("heading", { name: "2 de 3 médicos" })).toBeVisible();
    await expect(comparison.getByRole("heading", { name: "Dra. Marina Alves" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Comparar" }).first()).toBeVisible();
  });

  for (const width of MOBILE_VIEWPORTS) {
    test(`fits ${width}px without overflow and exposes button names`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openShell(page);

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        unnamedButtons: [...document.querySelectorAll("button")].filter((button) => {
          return !button.getAttribute("aria-label") && !button.textContent?.trim();
        }).length,
      }));

      expect(hasHorizontalOverflow(metrics)).toBe(false);
      expect(metrics.unnamedButtons).toBe(0);
    });
  }
});
