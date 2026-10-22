import { test, expect } from "@playwright/test";
import { today, shiftDays } from "../../server/index.js";

async function navigate(page, isMobile, name) {
  const nav = page.getByRole("navigation", {
    name: isMobile ? "Mobile navigation" : "Main navigation",
    exact: true,
  });
  await nav.getByRole("button", { name, exact: true }).click();
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test("dashboard renders chart, real counts, and responsive navigation", async ({
  page,
  isMobile,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Club overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Club growth" }),
  ).toBeVisible();
  await expect(page.locator(".stat-card").first()).toContainText(
    "Total members",
  );
  await page.getByRole("button", { name: "Revenue", exact: true }).click();
  await expect(page.locator(".chart-footer")).toContainText(
    "Membership revenue",
  );
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });
  expect(worker).toBe(true);
  await noOverflow(page);
  await page.screenshot({
    path: `/tmp/golds-gym-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("enrol, search, edit and renew a member with persisted records", async ({
  page,
  isMobile,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const name = `Showcase ${testInfo.project.name}`;
  await page.goto("/");
  await navigate(page, isMobile, "Members");
  await page.getByRole("button", { name: "Add member", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email address").fill(`${suffix}@example.com`);
  await dialog.getByLabel("Mobile number").fill("+91 98765 43210");
  await dialog.getByLabel("Membership plan").selectOption("2");
  await dialog.getByRole("button", { name: "Add member", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Search members").fill(name);
  let row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Quarterly");
  await row.locator(".member-cell").click();
  await page.getByRole("button", { name: "Edit details" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mobile number").fill("+91 98765 43211");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await row.locator(".member-cell").click();
  await expect(page.getByRole("dialog")).toContainText("+91 98765 43211");
  await page
    .getByRole("button", { name: "Renew membership", exact: true })
    .click();
  await page.getByLabel("Choose a membership plan").selectOption("3");
  await page.getByRole("button", { name: "Confirm renewal" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(row).toContainText("Annual");
  await page.reload();
  await navigate(page, isMobile, "Members");
  await page.getByLabel("Search members").fill(name);
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
    "Annual",
  );
  await noOverflow(page);
  await navigate(page, isMobile, "Overview");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Search members")).toHaveValue("");
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("renewal settings, reminder preview and simulated dispatch work", async ({
  page,
  request,
  isMobile,
}, testInfo) => {
  const response = await request.post("/api/members", {
    data: {
      name: `Reminder ${testInfo.project.name}`,
      email: `reminder-${Date.now()}@example.com`,
      phone: "9876543210",
      planId: 1,
      startDate: today(),
      expiryDate: shiftDays(today(), 7),
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await navigate(page, isMobile, "Renewals");
  const toggle = page.getByRole("checkbox", {
    name: "Enable renewal automation",
  });
  await toggle.uncheck();
  await expect(
    page.getByText("Automation paused", { exact: true }),
  ).toBeVisible();
  await toggle.check();
  await expect(page.getByText("Automation on", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Reminder channel" })
    .selectOption("email");
  await page.getByRole("button", { name: "Check renewals now" }).click();
  await expect(
    page.getByRole("button", { name: "Check renewals now" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Preview", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No message will be sent",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate dispatch", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Simulate dispatch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simulate dispatch", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator("tbody").getByText("Simulated", { exact: true }).first(),
  ).toBeVisible();
  await noOverflow(page);
});

test("assistant escalates to an IT query, and staff can resolve it", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Gold’s Assist" }).click();
  await page
    .getByLabel("Message assistant")
    .fill("What are the membership plans?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".chat-messages")).toContainText("₹3,000");
  await page
    .getByLabel("Message assistant")
    .fill("My membership payment failed");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page
    .getByRole("button", { name: "Raise a query with IT", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your name").fill(`Support ${testInfo.project.name}`);
  await dialog
    .getByLabel("Email address")
    .fill(`support-${Date.now()}@example.com`);
  await dialog.getByLabel("Category").selectOption("Billing");
  await dialog.getByLabel("Priority").selectOption("high");
  const subject = `Demo receipt request ${testInfo.project.name}`;
  await dialog.getByLabel("Subject").fill(subject);
  await dialog
    .getByLabel("Tell us a little more")
    .fill("My renewal receipt does not appear in my membership account.");
  await dialog.getByRole("button", { name: "Submit query" }).click();
  await expect(dialog).not.toBeVisible();
  await navigate(page, isMobile, isMobile ? "Support" : "Support desk");
  await page.getByRole("button").filter({ hasText: subject }).click();
  await page.getByLabel("Update status").selectOption("in_progress");
  await page.getByRole("button", { name: "Save status" }).click();
  let row = page.locator(".ticket-row").filter({ hasText: subject });
  await expect(row).toContainText("In progress");
  await row.locator(".ticket-info").click();
  await page.getByLabel("Update status").selectOption("resolved");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(row).toContainText("Resolved");
  await noOverflow(page);
});

test("a saved renewal is not offered again when only the view refresh fails", async ({
  page,
  request,
  isMobile,
}) => {
  const before = (await (await request.get("/api/members?search=priya")).json())
    .members[0];
  let renewals = 0;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().endsWith(`/api/members/${before.id}/renew`)
    )
      renewals++;
  });
  await page.goto("/");
  await navigate(page, isMobile, "Members");
  await page.getByLabel("Search members").fill("Priya Mehta");
  await page
    .getByRole("row")
    .filter({ hasText: "Priya Mehta" })
    .getByRole("button", { name: "Renew", exact: true })
    .click();
  await page.getByLabel("Choose a membership plan").selectOption("3");
  await page.route("**/api/overview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary refresh error" }),
    }),
  );
  await page.getByRole("button", { name: "Confirm renewal" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Membership renewed.");
  await expect(page.getByRole("status")).toContainText(
    "view could not refresh",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Temporary refresh error",
  );
  await page.unroute("**/api/overview");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
  expect(renewals).toBe(1);
  const after = await (await request.get(`/api/members/${before.id}`)).json();
  expect(after.expiryDate > before.expiryDate).toBe(true);
});
