import { expect, test } from "@playwright/test";

test("dashboard loads the local workbench", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pradyot's PMS Workbench")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Appraisal desk" })).toBeVisible();
});

test("navigation collapses to icons and expands again", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await expect(page.getByText("Pradyot's PMS Workbench")).toBeHidden();
  await expect(page.getByRole("link", { name: "Reportees" })).toBeVisible();
  await page.getByRole("button", { name: "Expand navigation" }).click();
  await expect(page.getByText("Pradyot's PMS Workbench")).toBeVisible();
});

test("each reportee has a segmented tab", async ({ page }) => {
  await page.goto("/reportees");
  const tabs = page.getByRole("tablist", { name: "Reportees" });
  await expect(tabs.getByRole("tab", { name: /Utkarsh/ })).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: /Krishna/ })).toBeVisible();
  await tabs.getByRole("tab", { name: /Santosh/ }).click();
  await expect(page.getByRole("heading", { name: "Santosh" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Santosh/ })).toHaveAttribute("aria-selected", "true");
});

test("dashboard quarter carries into the workspace, which has its own filters", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Quarter", { exact: true }).click();
  await page.getByRole("option", { name: "Q1-2026" }).click();
  await page.getByRole("link", { name: "Reportees" }).click();
  await expect(page.getByLabel("Year")).toHaveCount(0);
  await page.getByRole("tablist", { name: "Reportees" }).getByRole("tab", { name: /Utkarsh/ }).click();
  await expect(page.getByRole("tab", { name: "OKR checklist" })).toBeVisible();
  await expect(page.getByText("Quarter filter: Q1-2026")).toBeVisible();
  await page.getByLabel("Quarter", { exact: true }).click();
  await page.getByRole("option", { name: "Q4-2025" }).click();
  await expect(page.getByText("Quarter filter: Q4-2025")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Q4-2025" })).toBeVisible();
});

test("dashboard shows quarter-wise scores with status icons", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "Quarter-wise score" });
  await expect(table).toBeVisible();
  await expect(table.getByText("Santosh")).toBeVisible();
  await expect(table.getByRole("img", { name: /Q1-2026/ }).first()).toBeVisible();
});

test("a new reportee can be added without an employee id", async ({ page }) => {
  await page.goto("/reportees");
  await page.getByRole("button", { name: "Add reportee" }).click();
  await page.getByLabel("Full name").fill("Asha Rao");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Asha Rao" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Reportees" }).getByRole("tab", { name: /Asha Rao/ })).toHaveAttribute("aria-selected", "true");
});

test("theme toggle uses icons and each reportee tab has a distinct color", async ({ page }) => {
  await page.goto("/reportees");
  await expect(page.getByRole("heading", { name: "Utkarsh" })).toBeVisible();
  const darkButton = page.getByRole("button", { name: "Switch to dark theme" });
  await expect(darkButton).toBeVisible();
  await darkButton.click();
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Reportees" }).getByRole("tab");
  const colors: string[] = [];
  for (const name of [/Utkarsh/, /Krishna/, /Santosh/]) {
    const tab = page.getByRole("tablist", { name: "Reportees" }).getByRole("tab", { name });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    colors.push(await tab.evaluate((node) => getComputedStyle(node).backgroundColor));
  }
  await expect(tabs).toHaveCount(3);
  expect(new Set(colors).size).toBe(3);
});

test("dashboard remains readable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Appraisal desk" })).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByText("Pradyot's PMS Workbench")).toBeVisible();
});

test("a KPI opens the OKR row from the workbook, and that OKR opens its sheet", async ({ page }) => {
  await page.goto("/reportees/rep_utkarsh");
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  await page.getByRole("gridcell", { name: "OKR · Timely Delivery" }).first().click();
  await expect(page.getByRole("tab", { name: "OKR checklist" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Showing OKR · Timely Delivery. The linked OKR is highlighted.")).toBeVisible();
  await expect(page.getByText("Timely Delivery: Complete assigned tasks")).toBeVisible();
  await expect(page.getByText(/_OKR_Checklist!|_Ticket_Summary!/)).toHaveCount(0);
  await page.getByRole("gridcell", { name: "Q3-2025 ticket summary" }).first().click();
  await expect(page.getByRole("tab", { name: "Ticket master" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Quarter filter: Q3-2025")).toBeVisible();
  await expect(page.getByText("Showing Q3-2025 ticket summary.")).toBeVisible();
});
