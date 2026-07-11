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

  test("shows a public verified profile without moving the legacy site", async ({ page }) => {
    await page.goto("/medicos/dra-marina-alves");
    await expect(page.getByRole("heading", { name: "Dra. Marina Alves" })).toBeVisible();
    await expect(page.getByText("Alteração em revisão")).toBeVisible();
    await expect(page.getByRole("link", { name: "WhatsApp verificado" })).toHaveAttribute("href", /wa\.me/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://medario.com.br/medicos/dra-marina-alves");
  });

  test("interrupts urgent symptom reports without creating a search URL", async ({ page }) => {
    await openShell(page);
    await page.getByLabel("Descreva o que você precisa").fill("Estou com dor no peito e falta de ar");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.locator(".urgent-guidance")).toContainText("Busque atendimento imediato");
    expect(page.url()).not.toContain("dor");
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
