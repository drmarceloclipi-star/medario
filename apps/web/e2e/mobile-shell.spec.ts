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

    await page.getByLabel("Descreva o que você precisa").fill("Dor no peito e cardiologista");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Permitir e continuar" }).click();
    await page.getByLabel("Descreva o que você precisa").focus();

    await expect(page.getByRole("button", { name: /Dor no peito e cardiologista/ })).toBeVisible();
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
