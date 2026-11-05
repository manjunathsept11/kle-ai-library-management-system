/**
 * Captures every screenshot used by the PDF user guide, per persona.
 * Runs against the throwaway seeded stack (see playwright.guide.config.ts).
 *   npx playwright test -c playwright.guide.config.ts
 */
import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";

const OUT = "../docs/screenshots";
const PW = "Password123";
mkdirSync(OUT, { recursive: true });

let n = 0;
async function shot(page: Page, name: string, opts: { full?: boolean } = {}) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(450); // let transitions settle
  n += 1;
  await page.screenshot({
    path: `${OUT}/${String(n).padStart(2, "0")}-${name}.png`,
    fullPage: opts.full ?? false,
  });
}

/** Optional steps must never abort the whole capture. */
async function tryStep(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.warn(`[skip] ${label}: ${(e as Error).message.split("\n")[0]}`);
  }
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("you@kle.edu").fill(email);
  await page.getByPlaceholder("••••••••").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.locator(".sidebar").waitFor();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login$/);
}

test.use({
  // 1024 wide + 1.5x density: text stays legible when the shot is scaled to a printed page.
  viewport: { width: 1024, height: 680 },
  deviceScaleFactor: 1.5,
  reducedMotion: "reduce", // stable frames: count-ups land on final values
});

test("capture the user guide screenshots", async ({ page }) => {
  test.setTimeout(600_000);

  // ---------------------------------------------------------- public
  await page.goto("/login");
  await shot(page, "login");
  await page.goto("/register");
  await shot(page, "register");

  // ---------------------------------------------------------- student
  await login(page, "asha@kle.edu");
  await shot(page, "student-dashboard");

  await page.goto("/catalogue");
  await shot(page, "student-catalogue");
  await tryStep("catalogue search", async () => {
    await page.getByPlaceholder(/title, author/i).fill("java");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await shot(page, "student-catalogue-search");
  });

  await tryStep("book detail + request", async () => {
    await page.goto("/catalogue");
    await page.locator(".book-card").first().click();
    await page.waitForURL(/\/books\//);
    await shot(page, "student-book-detail");
    await page.getByRole("button", { name: /request to borrow/i }).click();
    await page.getByText(/request pending approval/i).waitFor();
    await shot(page, "student-request-pending");
    await page.getByRole("button", { name: /☆ save/i }).click();
    await page.getByRole("button", { name: /saved/i }).waitFor();
  });

  await tryStep("ai search", async () => {
    await page.goto("/ai-search");
    await page.locator("input, textarea").first().fill("learning to program in python for beginners");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    await shot(page, "student-ai-search");
  });

  await tryStep("assistant", async () => {
    await page.goto("/assistant");
    await shot(page, "student-assistant-empty");
    const box = page.locator("input, textarea").last();
    await box.fill("Do I have any fines, and when are my books due?");
    await box.press("Enter");
    await page.waitForTimeout(2500);
    await shot(page, "student-assistant-answer");
  });

  await tryStep("chat widget", async () => {
    await page.goto("/catalogue");
    await page.getByRole("button", { name: "Open AI assistant" }).click();
    const dlg = page.getByRole("dialog", { name: "AI assistant" });
    await dlg.locator("input").fill("What are the library hours?");
    await dlg.locator("input").press("Enter");
    await page.waitForTimeout(2500);
    await shot(page, "student-chat-widget");
    await page.keyboard.press("Escape");
  });

  await tryStep("command palette", async () => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.keyboard.type("fine");
    await shot(page, "student-command-palette");
    await page.keyboard.press("Escape");
  });

  await page.goto("/my-library");
  await shot(page, "student-my-library-current");
  for (const [tab, name] of [
    ["Requests", "requests"], ["Reservations", "reservations"],
    ["Fines", "fines"], ["History", "history"],
  ] as const) {
    await tryStep(`my-library ${tab}`, async () => {
      await page.getByRole("button", { name: new RegExp(`^${tab}`) }).click();
      await shot(page, `student-my-library-${name}`);
    });
  }

  await page.goto("/favorites");
  await shot(page, "student-favorites");
  await page.goto("/notifications");
  await shot(page, "student-notifications");
  await page.goto("/profile");
  await shot(page, "student-profile");
  await page.goto("/guide");
  await shot(page, "student-in-app-guide");

  await tryStep("notification dropdown", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Notifications" }).click();
    await shot(page, "student-notification-bell");
    await page.keyboard.press("Escape");
    await page.mouse.click(600, 600);
  });

  await tryStep("dark theme", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await shot(page, "student-dark-theme");
    await page.getByRole("button", { name: "Toggle theme" }).click();
  });

  await tryStep("collapsed sidebar", async () => {
    await page.getByRole("button", { name: "Collapse sidebar" }).first().click();
    await shot(page, "student-sidebar-collapsed");
    await page.getByRole("button", { name: "Collapse sidebar" }).first().click();
  });

  await tryStep("mobile", async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await shot(page, "student-mobile-dashboard");
    await page.getByRole("button", { name: "Open menu" }).click();
    await shot(page, "student-mobile-menu");
    await page.setViewportSize({ width: 1024, height: 680 });
  });
  await logout(page);

  // ---------------------------------------------------------- faculty
  await login(page, "prof.rao@kle.edu");
  await shot(page, "faculty-dashboard");
  await logout(page);

  // ---------------------------------------------------------- librarian
  await login(page, "librarian@kle.edu");
  await shot(page, "librarian-dashboard");

  await tryStep("approvals", async () => {
    await page.goto("/staff/requests");
    await shot(page, "librarian-approvals");
    await page.getByRole("button", { name: "Decline", exact: true }).first().click();
    await page.locator(".modal textarea").fill("Reference copy — please read it in the library");
    await shot(page, "librarian-decline-dialog");
    await page.locator(".modal").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: /✓ approve/i }).first().click();
    await page.waitForTimeout(500);
    await shot(page, "librarian-approved");
  });

  await tryStep("circulation issue", async () => {
    await page.goto("/staff/circulation");
    await shot(page, "librarian-circulation");
    await page.getByPlaceholder("Asha Nair").fill("Meera");
    await page.getByRole("button", { name: "Search", exact: true }).first().click();
    await page.getByRole("button", { name: "Select" }).first().click();
    await page.locator(".callout").waitFor();
    await page.getByPlaceholder("Clean Code").fill("Deep");
    await page.getByRole("button", { name: "Search", exact: true }).last().click();
    await page.waitForTimeout(600);
    await shot(page, "librarian-circulation-member", { full: true });
  });
  await tryStep("circulation return", async () => {
    await page.goto("/staff/circulation");
    await page.getByRole("button", { name: "Return", exact: true }).first().click();
    await shot(page, "librarian-circulation-return");
  });

  await page.goto("/staff/loans");
  await shot(page, "librarian-loans");
  await tryStep("loans overdue", async () => {
    await page.getByRole("button", { name: /^Overdue/ }).click();
    await shot(page, "librarian-loans-overdue");
  });

  await page.goto("/staff/reservations");
  await shot(page, "librarian-reservations");
  await page.goto("/staff/fines");
  await shot(page, "librarian-fines");
  await tryStep("fine payment", async () => {
    await page.getByRole("button", { name: "Pay" }).first().click();
    await shot(page, "librarian-fine-payment");
    await page.locator(".modal").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Waive", exact: true }).first().click();
    await shot(page, "librarian-fine-waive");
    await page.locator(".modal").getByRole("button", { name: "Cancel" }).click();
  });

  await page.goto("/staff/books");
  await shot(page, "librarian-books");
  await tryStep("add book", async () => {
    await page.getByRole("button", { name: /add book|\+/i }).first().click();
    await shot(page, "librarian-add-book");
    await page.keyboard.press("Escape");
    await page.locator(".modal").getByRole("button", { name: "Cancel" }).click().catch(() => {});
  });
  await page.goto("/staff/inventory");
  await shot(page, "librarian-inventory");
  await page.goto("/staff/shelves");
  await shot(page, "librarian-shelves");
  await page.goto("/staff/taxonomy");
  await shot(page, "librarian-taxonomy");
  await logout(page);

  // ---------------------------------------------------------- admin
  await login(page, "admin@kle.edu");
  await shot(page, "admin-dashboard");

  await page.goto("/admin/users");
  await shot(page, "admin-users");
  await tryStep("add user", async () => {
    await page.getByRole("button", { name: "+ Add user" }).click();
    const inputs = page.locator(".modal input");
    await inputs.nth(0).fill("new.student@kle.edu");
    await inputs.nth(1).fill("Welcome@123");
    await inputs.nth(2).fill("New Student");
    await shot(page, "admin-add-user");
    await page.locator(".modal").getByRole("button", { name: "Cancel" }).click();
  });
  await tryStep("edit user", async () => {
    await page.getByRole("button", { name: "Edit" }).first().click();
    await shot(page, "admin-edit-user");
    await page.locator(".modal").getByRole("button", { name: "Cancel" }).click();
  });
  await tryStep("reset password", async () => {
    await page.getByRole("button", { name: "Reset PW" }).first().click();
    await shot(page, "admin-reset-password");
    await page.locator(".modal").getByRole("button", { name: "Cancel" }).click();
  });

  await page.goto("/admin/departments");
  await shot(page, "admin-departments");
  await page.goto("/admin/reports");
  await shot(page, "admin-reports");
  await tryStep("reports tabs", async () => {
    await page.getByRole("button", { name: "Most borrowed" }).click();
    await shot(page, "admin-reports-popular");
  });
  await page.goto("/admin/settings");
  await shot(page, "admin-settings");
  await page.goto("/admin/audit");
  await shot(page, "admin-audit");
  await logout(page);
});
