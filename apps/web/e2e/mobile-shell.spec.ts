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
