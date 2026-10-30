import { expect, test } from "@playwright/test";

test("dashboard loads the local workbench", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pradyot's PMS Workbench")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Appraisal desk" })).toBeVisible();
});

test("Q3-2026 shows the ticket score instead of a blank quarter", async ({ page }) => {
  await page.goto("/");
  const board = page.getByRole("region", { name: "Quarter-wise score" });
  await expect(board.getByRole("button", { name: /Santosh/ })).toContainText("17.5 / 25");
  await expect(board.getByRole("button", { name: /Utkarsh/ })).toContainText("25 / 25");
  await expect(board.getByRole("button", { name: /Krishna/ })).toContainText("25 / 25");
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

test("dashboard charts pointers and omits the selected-quarter tile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pointers by quarter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pointer attainment" })).toBeVisible();
  await expect(page.getByText("With selected quarter")).toHaveCount(0);
});

test("adding a KPI past 100 pointers is rejected, and an existing KPI can be opened for edit", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "KPIs" }).click();
  await page.getByRole("tablist", { name: "Reportees" }).getByRole("tab", { name: /Utkarsh/ }).click();
  await page.getByRole("button", { name: "Add KPI" }).click();
  const dialog = page.getByRole("dialog", { name: "Add KPI" });
  await dialog.getByLabel("KPI name").fill("Customer follow-up");
  await dialog.getByRole("spinbutton", { name: "Pointers" }).fill("10");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/cannot exceed 100/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("gridcell", { name: "Edit" }).first().click();
  await expect(page.getByRole("heading", { name: "Edit KPI" })).toBeVisible();
});

test("dashboard shows quarter-wise scores with status icons", async ({ page }) => {
  await page.goto("/");
  const board = page.getByRole("region", { name: "Quarter-wise score" });
  await expect(board).toBeVisible();
  await expect(board.getByText("Santosh")).toBeVisible();
  await expect(board.getByRole("img", { name: /Q1-2026/ }).first()).toBeVisible();
});

test("a new reportee can be added without an employee id", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Reportees" }).click();
  await page.getByRole("button", { name: "Add reportee" }).click();
  await page.getByLabel("Full name").fill("Asha Rao");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("gridcell", { name: "Asha Rao" })).toBeVisible();
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
