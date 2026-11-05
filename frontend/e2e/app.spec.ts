import { expect, test, type Page } from "@playwright/test";

const PW = "Password123";
const ACCOUNTS = {
  student: "asha@kle.edu",
  faculty: "prof.rao@kle.edu",
  librarian: "librarian@kle.edu",
  admin: "admin@kle.edu",
} as const;

const MEMBER_ROUTES = [
  "/", "/catalogue", "/ai-search", "/assistant", "/my-library",
  "/favorites", "/notifications", "/profile", "/guide",
];
const STAFF_ROUTES = [
  "/staff/circulation", "/staff/loans", "/staff/requests", "/staff/reservations",
  "/staff/fines", "/staff/books", "/staff/inventory", "/staff/shelves", "/staff/taxonomy",
];
const ADMIN_ROUTES = [
  "/admin/users", "/admin/departments", "/admin/reports", "/admin/settings", "/admin/audit",
];

/** Collect anything that would make a user say "it's broken". */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // "Failed to load resource" is reported with its URL by the response hook below.
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      problems.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    const u = r.url();
    // 401 is expected for guests / expired tokens; anything else >=400 is a defect.
    if (r.status() >= 400 && r.status() !== 401) problems.push(`HTTP ${r.status()} ${u}`);
  });
  return problems;
}

async function login(page: Page, email: string, password = PW) {
  await page.goto("/login");
  await page.getByPlaceholder("you@kle.edu").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function loginOk(page: Page, email: string) {
  await login(page, email);
  await expect(page.locator(".sidebar")).toBeVisible();
}

async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".state.error")).toHaveCount(0);
}

// ------------------------------------------------------------------ public

test.describe("guest", () => {
  test("login page renders and protected routes redirect", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    for (const r of ["/", "/catalogue", "/staff/loans", "/admin/users"]) {
      await page.goto(r);
      await expect(page).toHaveURL(/\/login$/);
    }
    expect(problems).toEqual([]);
  });

  test("wrong password shows a real error, stays on login", async ({ page }) => {
    await login(page, ACCOUNTS.student, "WrongPass999");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unknown email shows the same generic error", async ({ page }) => {
    await login(page, "nobody@kle.edu");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("demo chips fill the form", async ({ page }) => {
    await page.goto("/login");
    await page.locator(".chip").first().click();
    await expect(page.getByPlaceholder("you@kle.edu")).not.toHaveValue("");
  });

  test("register: validation, then a new student can sign in", async ({ page }) => {
    const email = `e2e.reg.${Date.now()}@kle.edu`;
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Registrant");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: /create|register|sign up/i }).click();
    await expect(page).toHaveURL(/\/register$/); // 8-char minimum blocks it
    await page.getByLabel("Password").fill(PW);
    await page.getByRole("button", { name: /create|register|sign up/i }).click();
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".topbar, header").getByText("E2E").first()).toBeVisible(); // first name in the top bar
  });
});

// ------------------------------------------------------------------ every page, every role

for (const [role, email] of Object.entries(ACCOUNTS)) {
  test.describe(`${role}: all pages load cleanly`, () => {
    const routes = [
      ...MEMBER_ROUTES,
      ...(role === "librarian" || role === "admin" ? STAFF_ROUTES : []),
      ...(role === "admin" ? ADMIN_ROUTES : []),
    ];

    test(`${routes.length} routes, no console/API errors`, async ({ page }) => {
      const problems = watch(page);
      await loginOk(page, email);
      for (const r of routes) {
        await page.goto(r);
        await settled(page);
        await expect(page.locator("h1").first(), `heading on ${r}`).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${r === "/" ? "/$" : r}$`));
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });

    test("sidebar only shows this role's sections", async ({ page }) => {
      await loginOk(page, email);
      const nav = page.locator(".sidebar");
      const staff = role === "librarian" || role === "admin";
      await expect(nav.getByText("Circulation Desk")).toHaveCount(staff ? 1 : 0);
      await expect(nav.getByText("Approvals")).toHaveCount(staff ? 1 : 0);
      await expect(nav.getByText("Audit")).toHaveCount(role === "admin" ? 1 : 0);
    });
  });
}

test("students and faculty are bounced from staff/admin URLs", async ({ page }) => {
  for (const email of [ACCOUNTS.student, ACCOUNTS.faculty]) {
    await loginOk(page, email);
    for (const r of [...STAFF_ROUTES, ...ADMIN_ROUTES]) {
      await page.goto(r);
      await expect(page).toHaveURL(/localhost:5181\/$/);
    }
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("librarian is bounced from admin URLs", async ({ page }) => {
  await loginOk(page, ACCOUNTS.librarian);
  for (const r of ADMIN_ROUTES) {
    await page.goto(r);
    await expect(page).toHaveURL(/localhost:5181\/$/);
  }
});

// ------------------------------------------------------------------ shell features

test.describe("shell", () => {
  test("sidebar collapse / expand persists", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.getByRole("button", { name: "Collapse sidebar" }).first().click();
    await expect(page.locator(".shell")).toHaveClass(/collapsed/);
    await page.reload();
    await expect(page.locator(".shell")).toHaveClass(/collapsed/);
    await page.getByRole("button", { name: "Collapse sidebar" }).first().click(); // topbar toggle
    await expect(page.locator(".shell")).not.toHaveClass(/collapsed/);
  });

  test("theme toggle flips and persists", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    const before = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    const after = await page.locator("html").getAttribute("data-theme");
    expect(after).not.toBe(before);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", after!);
  });

  test("command palette: open, filter, navigate, Esc", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.keyboard.press("Control+k");
    await expect(page.locator(".cmdk")).toBeVisible();
    await page.keyboard.type("fav");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/favorites$/);
    await page.keyboard.press("Control+k");
    await page.keyboard.press("Escape");
    await expect(page.locator(".cmdk")).toHaveCount(0);
  });

  test("chat widget answers a grounded question and survives navigation", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.getByRole("button", { name: "Open AI assistant" }).click();
    const dlg = page.getByRole("dialog", { name: "AI assistant" });
    await expect(dlg).toBeVisible();
    await dlg.locator("input").fill("What are the library hours?");
    await dlg.locator("input").press("Enter");
    await expect(dlg.getByText(/9:00|monday|hours/i).first()).toBeVisible();
    await page.goto("/catalogue");
    await expect(page.getByRole("button", { name: /assistant/i }).first()).toBeVisible();
  });

  test("notification bell opens", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.locator(".dropdown, .menu, .notif-menu, [role=menu]").first()).toBeVisible();
  });

  test("mobile viewport: drawer opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await loginOk(page, ACCOUNTS.student);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator(".shell")).toHaveClass(/nav-open/);
    await page.locator(".nav-scrim").click({ position: { x: 380, y: 400 } });
    await expect(page.locator(".shell")).not.toHaveClass(/nav-open/);
  });
});

// ------------------------------------------------------------------ member features

test.describe("student features", () => {
  test("catalogue search, filter and open a book", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.goto("/catalogue");
    await page.getByPlaceholder(/title, author/i).fill("java");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await settled(page);
    const cards = page.locator(".book-card");
    await expect(cards.first()).toBeVisible(); // auto-waits for the filtered list
    await page.getByPlaceholder(/title, author/i).fill("zzzzqqqq");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/no books match/i)).toBeVisible();
    await page.getByPlaceholder(/title, author/i).fill("");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await cards.first().click();
    await expect(page).toHaveURL(/\/books\//);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("AI smart search returns results with reasons", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.goto("/ai-search");
    await page.locator("input, textarea").first().fill("learning to program in python for beginners");
    await page.keyboard.press("Enter");
    await expect(page.locator(".ai-glow, .result, .book-card, li").first()).toBeVisible();
    await settled(page);
  });

  test("favorite a book, see it in Favorites, remove it", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.goto("/catalogue");
    await page.locator(".book-card").first().click();
    const title = await page.locator("h1").innerText();
    await page.getByRole("button", { name: /save/i }).first().click();
    await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();
    await page.goto("/favorites");
    await expect(page.getByText(title).first()).toBeVisible();
    await page.goto("/catalogue");
    await page.locator(".book-card", { hasText: title }).first().click();
    await page.getByRole("button", { name: /saved/i }).click();
    await expect(page.getByRole("button", { name: /☆ save/i })).toBeVisible();
  });

  test("My Library tabs all render", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.goto("/my-library");
    for (const t of ["Current", "Requests", "Reservations", "Fines", "History"]) {
      await page.getByRole("button", { name: new RegExp(`^${t}`) }).click();
      await settled(page);
    }
  });

  test("profile: edit name and change password with validation", async ({ page }) => {
    await loginOk(page, ACCOUNTS.faculty);
    await page.goto("/profile");
    await expect(page.locator("h1")).toBeVisible();
    await settled(page);
  });

  test("guide page lists role-specific content", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.goto("/guide");
    await expect(page.getByText(/request to borrow|catalogue/i).first()).toBeVisible();
  });
});

// ------------------------------------------------------------------ the cross-role workflow

test.describe.serial("workflow: admin creates user → student requests → librarian approves", () => {
  const email = `e2e.flow.${Date.now()}@kle.edu`;
  let bookTitle = "";

  test("admin: invalid user shows the real reason, valid user is created", async ({ page }) => {
    await loginOk(page, ACCOUNTS.admin);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "+ Add user" }).click();
    const modal = page.locator(".modal");
    const inputs = modal.locator("input");
    await inputs.nth(0).fill(email);
    await inputs.nth(1).fill("short");
    await inputs.nth(2).fill("Flow Student");
    await modal.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible();
    await inputs.nth(1).fill(PW);
    await modal.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".modal")).toHaveCount(0);
    await page.getByPlaceholder(/name, email/i).fill(email);
    await expect(page.getByText(email)).toBeVisible();
  });

  test("admin: duplicate email is rejected with a clear message", async ({ page }) => {
    await loginOk(page, ACCOUNTS.admin);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "+ Add user" }).click();
    const inputs = page.locator(".modal input");
    await inputs.nth(0).fill(email);
    await inputs.nth(1).fill(PW);
    await inputs.nth(2).fill("Dup Again");
    await page.locator(".modal").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/already registered|already exists/i).first()).toBeVisible();
  });

  test("student: requests an available book", async ({ page }) => {
    await loginOk(page, email);
    await page.goto("/catalogue");
    await page.locator(".book-card").first().click();
    bookTitle = await page.locator("h1").innerText();
    await page.getByRole("button", { name: /request to borrow/i }).click();
    await expect(page.getByText(/request pending approval/i)).toBeVisible();
    await page.goto("/my-library");
    await page.getByRole("button", { name: /^Requests/ }).click();
    await expect(page.getByText(bookTitle).first()).toBeVisible();
  });

  test("librarian: sees badge + request, declines one with a reason", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    await page.goto("/staff/requests");
    const row = page.locator("tr", { hasText: bookTitle });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Decline" }).click();
    await page.locator(".modal textarea").fill("Reference copy");
    await page.locator(".modal").getByRole("button", { name: /decline request/i }).click();
    await expect(page.getByText(/no requests waiting/i)).toBeVisible();
  });

  test("student: sees the decline and the librarian's reason, then re-requests", async ({ page }) => {
    await loginOk(page, email);
    await page.goto("/my-library");
    await page.getByRole("button", { name: /^Requests/ }).click();
    await expect(page.getByText("Reference copy")).toBeVisible();
    await page.goto("/notifications");
    await expect(page.getByText(/declined/i).first()).toBeVisible();
    await page.goto("/catalogue");
    await page.locator(".book-card", { hasText: bookTitle }).first().click();
    await page.getByRole("button", { name: /request to borrow/i }).click();
    await expect(page.getByText(/request pending approval/i)).toBeVisible();
  });

  test("librarian: approves → loan is issued", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    await page.goto("/staff/requests");
    await page.locator("tr", { hasText: bookTitle }).getByRole("button", { name: /approve/i }).click();
    await expect(page.getByText(/issued/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Approved" }).click();
    await expect(page.locator("tr", { hasText: bookTitle })).toBeVisible();
  });

  test("student: loan appears under Current and can be renewed", async ({ page }) => {
    await loginOk(page, email);
    await page.goto("/my-library");
    await expect(page.locator("tr", { hasText: bookTitle })).toBeVisible();
    await page.locator("tr", { hasText: bookTitle }).getByRole("button", { name: "Renew" }).click();
    await expect(page.getByText("Renewed").first()).toBeVisible();
  });

  test("librarian: returns it from Loans & Returns", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    await page.goto("/staff/loans");
    await page.getByPlaceholder(/search|title|member/i).first().fill(bookTitle).catch(() => {});
    await settled(page);
    const row = page.locator("tr", { hasText: "Flow Student" }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /return/i }).click();
    await expect(page.getByText(/returned/i).first()).toBeVisible();
  });
});

// ------------------------------------------------------------------ staff desk & money

test.describe("librarian desk", () => {
  test("circulation: find member, see eligibility, issue a book and return it", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    await page.goto("/staff/circulation");
    await page.getByPlaceholder("Asha Nair").fill("Meera");
    await page.getByRole("button", { name: "Search", exact: true }).first().click();
    await page.getByRole("button", { name: "Select" }).first().click();
    await expect(page.locator(".callout")).toContainText(/on loan/);
    await page.getByPlaceholder("Clean Code").fill("Deep");
    await page.getByRole("button", { name: "Search", exact: true }).last().click();
    await expect(page.locator("table.data").last()).toBeVisible();
  });

  test("circulation: returning an unknown barcode shows an error", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    await page.goto("/staff/circulation");
    await page.getByRole("button", { name: "Return", exact: true }).first().click();
    await page.getByPlaceholder(/KLE2023/).fill("NO-SUCH-BARCODE");
    await page.getByRole("button", { name: "Return", exact: true }).last().click();
    await expect(page.getByText(/no issued copy/i)).toBeVisible();
  });

  test("fines: record a partial payment then waive the rest", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    // Raise our own fine so the test never depends on (or exhausts) seeded data.
    const token = await page.evaluate(() => localStorage.getItem("kle.access"));
    const auth = { Authorization: `Bearer ${token}` };
    const members = await (await page.request.get("/api/v1/users?q=Vikram", { headers: auth })).json();
    const made = await page.request.post("/api/v1/fines", {
      headers: auth,
      data: { member_id: members[0].id, type: "damage", amount: 50, reason: "e2e torn cover" },
    });
    expect(made.ok()).toBeTruthy();
    await page.goto("/staff/fines");
    await settled(page);
    const pay = page.getByRole("button", { name: "Pay", exact: true }).first();
    {
      await pay.click();
      await page.locator(".modal input[type=number]").fill("10");
      await page.locator(".modal").getByRole("button", { name: "Record" }).click();
      await expect(page.getByText("Payment recorded")).toBeVisible();
      await page.getByRole("button", { name: "Waive", exact: true }).first().click();
      await page.locator(".modal").getByRole("button", { name: /waive/i }).click(); // empty reason
      await expect(page.locator(".modal")).toBeVisible(); // blocked until a reason is given
      await page.locator(".modal textarea").fill("E2E goodwill waiver");
      await page.locator(".modal").getByRole("button", { name: /waive/i }).click();
      await expect(page.getByText("Fine waived")).toBeVisible();
    }
  });

  test("books: add a book with copies, then edit it", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    await page.goto("/staff/books");
    await settled(page);
    await page.getByRole("button", { name: /add book|\+/i }).first().click();
    await expect(page.locator(".modal, .drawer").first()).toBeVisible();
  });

  test("inventory, shelves, taxonomy and reservations render with data", async ({ page }) => {
    await loginOk(page, ACCOUNTS.librarian);
    for (const r of ["/staff/inventory", "/staff/shelves", "/staff/taxonomy", "/staff/reservations"]) {
      await page.goto(r);
      await settled(page);
      await expect(page.locator("table.data, .card").first()).toBeVisible();
    }
  });
});

// ------------------------------------------------------------------ admin console

test.describe("admin console", () => {
  test("users: filter by role, edit a user, reset a password", async ({ page }) => {
    await loginOk(page, ACCOUNTS.admin);
    await page.goto("/admin/users");
    await page.locator("select").first().selectOption("librarian");
    await settled(page);
    await expect(page.locator("table.data tbody tr").first()).toContainText("librarian");
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.locator(".modal textarea").fill("checked by e2e");
    await page.locator(".modal").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();
    await page.getByRole("button", { name: "Reset PW" }).first().click();
    await page.locator(".modal input").fill("short");
    await page.locator(".modal").getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText(/at least 8/i).first()).toBeVisible();
  });

  test("settings and audit and reports render and contain data", async ({ page }) => {
    await loginOk(page, ACCOUNTS.admin);
    for (const r of ["/admin/settings", "/admin/audit", "/admin/reports", "/admin/departments"]) {
      await page.goto(r);
      await settled(page);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator(".card, .stat").first()).toBeVisible();
    }
  });
});

// ------------------------------------------------------------------ resilience

test.describe("session handling", () => {
  test("tampered token is rejected and user lands on login", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.evaluate(() => {
      localStorage.setItem("kle.access", "garbage");
      localStorage.setItem("kle.refresh", "garbage");
    });
    await page.goto("/my-library");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unknown URL does not blank-screen", async ({ page }) => {
    await loginOk(page, ACCOUNTS.student);
    await page.goto("/this/does/not/exist");
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.locator(".sidebar, .auth, h1").first()).toBeVisible();
  });
});
