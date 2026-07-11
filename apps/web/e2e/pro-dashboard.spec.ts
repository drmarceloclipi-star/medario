import { expect, test } from "@playwright/test";

test("mostra Medário Pro individual, privado e com autorização de agenda revogável", async ({ page }) => {
  await page.goto("/pro");
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveTitle("Medário Pro");
  await expect(page.getByText("Esta visão pertence apenas à Dra. Marina Alves e ao Perfil médico reivindicado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alteração em revisão" })).toBeVisible();

  const metrics = page.getByRole("region", { name: "Visão geral" });
  await expect(metrics.getByText("Métrica agregada. Sem texto de busca, sintomas ou localização exata.")).toBeVisible();

  const calendar = page.locator("section").filter({ has: page.getByRole("heading", { name: "Google Calendar" }) });
  await expect(calendar.getByText("Não conectado", { exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "Simular conexão explícita" }).click();
  await expect(calendar.getByText("Conectado", { exact: true })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Revogar autorização" })).toBeVisible();

  await calendar.getByRole("button", { name: "Revogar autorização" }).click();
  await expect(calendar.getByText("Não conectado", { exact: true })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Simular conexão explícita" })).toBeVisible();
});
