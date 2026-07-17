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

  test("keeps modal focus contained and restores the opener", async ({ page }) => {
    await openShell(page);

    const filterOpener = page.getByRole("button", { name: "Adicionar filtros" });
    await filterOpener.click();
    const sheet = page.getByRole("dialog", { name: "Filtros da busca" });
    await expect(sheet).toBeFocused();
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(filterOpener).toBeFocused();

    const menuOpener = page.getByRole("button", { name: "Abrir menu" });
    await menuOpener.click();
    await expect(page.getByRole("dialog", { name: "Menu principal" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(menuOpener).toBeFocused();
  });

  test("uses WCAG-compliant contrast in the filter sheet", async ({ page }) => {
    await openShell(page);
    await page.getByRole("button", { name: "Adicionar filtros" }).click();

    const ratio = await page.getByRole("heading", { name: "Refinar sua busca" }).evaluate((heading) => {
      const parse = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const luminance = (value: string) => parse(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
      const foreground = luminance(getComputedStyle(heading).color);
      const background = luminance(getComputedStyle(heading.closest('[role="dialog"]')!).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test("does not persist symptom search after consent refusal and shares derived filters only", async ({ page }) => {
    await openShell(page);

    await page.getByLabel("Descreva o que você precisa").fill("Tenho ansiedade, psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("dialog", { name: "Dados de saúde nesta busca" })).toBeFocused();
    await page.getByRole("button", { name: "Continuar sem consentimento" }).click();

    await expect(page).toHaveURL(/specialty=psiquiatria/);
    await expect(page.getByRole("button", { name: "Buscar" })).toBeFocused();
    await expect(page).toHaveURL(/city=joinville/);
    expect(page.url()).not.toContain("ansiedade");
    await page.getByLabel("Descreva o que você precisa").focus();
    await expect(page.getByText("Tenho ansiedade, psiquiatra em Joinville")).toHaveCount(0);
  });

  test("consumes a public Joinville bridge URL and preserves only its objective filter", async ({ page }) => {
    await page.goto("/?city=joinville&entry=directory-joinville&q=ansiedade&email=patient@example.com");
    await expect(page).toHaveURL("/?city=joinville");
    await expect(page.getByRole("heading", { name: "Filtros prontos para resultados" })).toBeFocused();
    await expect(page.getByText("Cidade: Joinville ×")).toBeVisible();
    expect(page.url()).not.toContain("ansiedade");
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

  test("keeps result actions keyboard-operable", async ({ page }) => {
    await openShell(page);
    await page.getByLabel("Descreva o que você precisa").fill("Psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();

    const select = page.getByRole("button", { name: "Selecionar no mapa" }).first();
    await select.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Selecionado no mapa" }).first()).toBeFocused();
    await expect(page.locator(".result-card.selected")).toContainText("Dra. Marina Alves");
  });

  test("fits search results at 320px with 44px touch targets", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await openShell(page);
    await page.getByLabel("Descreva o que você precisa").fill("Psiquiatra em Joinville");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("heading", { name: "Dra. Marina Alves" })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      undersized: [...document.querySelectorAll<HTMLElement>('a[href],button,input,select')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map((element) => element.getAttribute('aria-label') || element.textContent?.trim()),
    }));

    expect(hasHorizontalOverflow(metrics)).toBe(false);
    expect(metrics.undersized).toEqual([]);
  });

  test("reflows search results when text is enlarged to 200 percent", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?specialty=psiquiatria&city=joinville");
    await page.locator("html").evaluate(async (element) => {
      element.style.fontSize = "200%";
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    await expect(page.getByRole("heading", { name: "Dra. Marina Alves" })).toBeVisible();

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
      message: "document overflow beyond one CSS pixel of cross-platform rounding after text enlargement",
    }).toBeLessThanOrEqual(1);
  });

  test("shows the migrated public profile without moving the legacy site", async ({ page }) => {
    await page.goto("/medicos/dra-marina-alves");
    await expect(page).toHaveURL(/\/medicos\/mariana-andrade$/);
    await expect(page.getByRole("heading", { name: "Dra. Mariana Andrade" })).toBeVisible();
    await expect(page.getByText("Dados atualizados em")).toBeVisible();
    await expect(page.getByRole("link", { name: "WhatsApp verificado" })).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://medario.com.br/medicos/mariana-andrade");
    const undersized = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('a[href],button,input,select')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      })
      .map((element) => element.textContent?.trim()));
    expect(undersized).toEqual([]);
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

  test('fits 1280px with the same accessible app shell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openShell(page);
    const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
    expect(hasHorizontalOverflow(metrics)).toBe(false);
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
  });
});
