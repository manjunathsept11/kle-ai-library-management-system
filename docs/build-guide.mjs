/**
 * Builds docs/KLE-Library-User-Guide.pdf from docs/screenshots/*.png.
 *   cd frontend && npx playwright test -c playwright.guide.config.ts   # (re)capture screenshots
 *   cd frontend && node ../docs/build-guide.mjs                        # build the PDF
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "..", "frontend", "package.json"));
const { chromium } = require("@playwright/test");

const SHOTS = join(here, "screenshots");
const files = readdirSync(SHOTS).filter((f) => f.endsWith(".png"));
const shotFile = (key) => files.find((f) => f.replace(/^\d+-/, "").replace(/\.png$/, "") === key);
const missing = [];

// ------------------------------------------------------------------ helpers
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let figNo = 0;
const fig = (key, caption) => {
  const f = shotFile(key);
  if (!f) { missing.push(key); return ""; }
  const b64 = readFileSync(join(SHOTS, f)).toString("base64");
  figNo += 1;
  return `<figure><img src="data:image/png;base64,${b64}" alt="${esc(caption)}"><figcaption><b>Figure ${figNo}.</b> ${caption}</figcaption></figure>`;
};
const steps = (items) => `<ol class="steps">${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
const bullets = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const tip = (t) => `<div class="callout tip"><b>Tip</b>${t}</div>`;
const note = (t) => `<div class="callout note"><b>Note</b>${t}</div>`;
const warn = (t) => `<div class="callout warn"><b>Careful</b>${t}</div>`;
const table = (head, rows, cls = "") =>
  `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const flow = (items) =>
  `<div class="flow">${items.map((i, n) => `${n ? '<span class="arrow">→</span>' : ""}<div class="node">${i}</div>`).join("")}</div>`;

const persona = { student: "Student", faculty: "Faculty", librarian: "Librarian", admin: "Administrator" };
const badge = (...p) => p.map((x) => `<span class="pill ${x}">${persona[x]}</span>`).join(" ");

// ------------------------------------------------------------------ content
const chapters = [];
const chapter = (id, title, who, body) => chapters.push({ id, title, who, body });

chapter("about", "About this guide", [], `
<p>This guide explains how to use the <b>KLE Institute AI Library</b> web application from the point of view of each kind
of user. Find your role below and read that chapter; Chapter 2 (<i>Getting started</i>) is for everyone.</p>
${table(["If you are a…", "Read", "You can"], [
  [badge("student"), "Chapters 2 and 3", "Search the catalogue, ask the AI assistant, request books, reserve titles, renew loans, see fines."],
  [badge("faculty"), "Chapters 2 and 3", "Everything a student can do, with a longer loan period and a higher borrowing limit."],
  [badge("librarian"), "Chapters 2 and 4", "Run the circulation desk, approve borrow requests, manage fines, books, copies, shelves and categories."],
  [badge("admin"), "Chapters 2 to 5", "Everything a librarian can do, plus users, departments, reports, library policy settings and the audit log."],
])}
<h3>What the application does</h3>
${bullets([
  "<b>Catalogue &amp; availability</b> — every title, how many copies exist and how many are on the shelf right now.",
  "<b>AI search &amp; assistant</b> — describe what you need in your own words; ask questions about library rules or your own account.",
  "<b>Borrow requests with approval</b> — members request an available book, a librarian approves (the loan is issued) or declines with a reason.",
  "<b>Reservations</b> — join a queue for a title that is fully on loan; you are notified when a copy is held for you.",
  "<b>Circulation, fines &amp; inventory</b> — issue/return/renew, record payments or waive fines, track every copy and shelf.",
  "<b>Administration</b> — accounts and roles, institution policy numbers, reports and a full audit trail.",
])}
${note("The screenshots in this guide were taken from the demo build, which is filled with <b>fictional</b> books, members and loans. Your own library's data will look different, but every screen works the same way.")}
<h3>Conventions</h3>
<p>Buttons and menu items appear in <b>bold</b>. ${badge("student", "faculty", "librarian", "admin")} tags show who can use a feature.
<span class="callout-inline tip">Tip</span> boxes are shortcuts; <span class="callout-inline warn">Careful</span> boxes mark actions that are hard to undo.</p>
`);

chapter("start", "Getting started", ["student", "faculty", "librarian", "admin"], `
<h3>2.1 Opening the application</h3>
<p>Open a web browser (Chrome, Edge, Firefox or Safari) and go to the address your library gives you. On a local demo
installation this is <code>http://localhost:5180</code>. The application works on desktop, tablet and phone screens.</p>

<h3>2.2 Signing in</h3>
${steps([
  "Type your <b>Email</b> and <b>Password</b>.",
  "Press <b>Sign in</b>. You land on your personal dashboard.",
  "On the demo build, the <b>demo account chips</b> under the form fill in the email for you (password <code>Password123</code>).",
])}
${fig("login", "The sign-in page. The demo chips at the bottom pre-fill an account for each role.")}
${warn("After <b>5 wrong passwords</b> the account locks for <b>15 minutes</b> to stop password guessing. Wait, or ask an administrator to reset your password. The error message is deliberately the same whether the email or the password was wrong.")}

<h3>2.3 Creating an account (students and faculty)</h3>
${steps([
  "On the sign-in page choose <b>Create an account</b>.",
  "Enter your <b>Full name</b>, <b>Email</b> and a <b>Password</b> (at least 8 characters).",
  "Choose <b>I am a</b> student or faculty and optionally enter your <b>Roll / Employee no.</b>",
  "Press the create button. You are signed in straight away.",
])}
${fig("register", "Self-registration. Staff accounts (librarian, administrator) can only be created by an administrator.")}

<h3>2.4 Demo accounts</h3>
${table(["Role", "Email", "Password"], [
  ["Student", "asha@kle.edu (also meera@kle.edu, vikram@kle.edu)", "Password123"],
  ["Faculty", "prof.rao@kle.edu", "Password123"],
  ["Librarian", "librarian@kle.edu", "Password123"],
  ["Administrator", "admin@kle.edu", "Password123"],
])}

<h3>2.5 Finding your way around</h3>
<p>Every page shares the same frame. The <b>sidebar</b> on the left lists the pages you may use — students see the
member pages, librarians also see a <b>Librarian</b> section, administrators also see an <b>Admin</b> section. The
<b>top bar</b> holds the menu toggle, the page name, the <b>Search Ctrl&nbsp;K</b> quick-jump chip, the light/dark theme
switch, the notification bell and your profile menu.</p>
${fig("student-dashboard", "The student dashboard: borrowing status at the top, then loans, reservations and suggestions.")}
${table(["Control", "What it does"], [
  ["« / ☰ button", "Collapses the sidebar to icons (desktop) or opens it as a drawer (phone). Your choice is remembered."],
  ["<b>Search Ctrl K</b>", "Opens the command palette — jump to any page, search the catalogue or ask the assistant from the keyboard (see 3.8)."],
  ["☾ theme button", "Switches between light and dark mode. Remembered on this device."],
  ["◔ bell", "Shows your newest notifications; a red dot means unread items."],
  ["Avatar / name", "Opens your profile menu — profile page and <b>Sign out</b>."],
  ["Round ✦ button (bottom right)", "Opens the AI assistant chat from any page."],
])}
${fig("student-notification-bell", "The notification bell lists recent alerts such as approved requests, due dates and held reservations.")}
${fig("student-sidebar-collapsed", "A collapsed sidebar leaves more room for tables. Press « again to expand.")}
${fig("student-dark-theme", "Dark mode — useful in low light. The setting follows you on this device.")}
${fig("student-mobile-dashboard", "On a phone the layout stacks into a single column.")}
${fig("student-mobile-menu", "The menu opens as a drawer on small screens; tap outside it to close.")}
`);

chapter("member", "Student &amp; faculty guide", ["student", "faculty"], `
<h3>3.1 Your dashboard</h3>
<p>The dashboard is your starting point. It summarises how many books you have on loan against your limit, anything
overdue or fined, reservations that are ready to collect, and quick links into the catalogue.</p>

<h3>3.2 Browsing and searching the catalogue</h3>
${steps([
  "Open <b>Catalogue</b> in the sidebar.",
  "Type a title, author, ISBN or keyword and press <b>Search</b>.",
  "Narrow the list with the <b>category</b> drop-down or tick <b>Available only</b> to hide titles that are fully on loan.",
  "Click a book card to open its details.",
])}
${fig("student-catalogue", "The catalogue shows each title with its cover, author and live availability (available / total copies).")}
${fig("student-catalogue-search", "Searching narrows the grid. A green badge means at least one copy is on the shelf; red means none.")}
${tip("Cards tilt toward your cursor on desktop. This is only decoration and is switched off automatically if your computer is set to <i>Reduce motion</i>.")}

<h3>3.3 A book's page</h3>
<p>The detail page shows the author(s), ISBN, publisher, edition, year, category, language and availability, plus a
description and a <b>Similar books</b> panel — titles the AI judged to be close in meaning, each tagged <i>AI semantic match</i>.</p>
${fig("student-book-detail", "Book details. The action buttons at the top depend on whether a copy is available.")}
${table(["Button", "Shown when", "What happens"], [
  ["<b>✋ Request to borrow</b>", "A copy is available", "Sends a request to the librarians. See 3.4."],
  ["<b>Request pending approval</b>", "You already asked for this title", "Nothing to press — wait for the decision."],
  ["<b>⧗ Reserve</b>", "Every copy is on loan", "Puts you in the queue for the next returned copy. See 3.9."],
  ["<b>☆ Save / ★ Saved</b>", "Always", "Adds or removes the title from your Favorites."],
])}

<h3>3.4 Requesting a book and waiting for approval</h3>
<p>Borrowing is a two-step process so the library keeps control of who takes which copy:</p>
${flow(["You press <b>Request to borrow</b>", "Request is <b>Pending</b>", "A librarian <b>approves</b>", "Loan is issued — collect at the desk"])}
${steps([
  "Open an available book and press <b>✋ Request to borrow</b>. A confirmation appears and the button changes to <b>Request pending approval</b>.",
  "Librarians are notified immediately. You can follow progress under <b>My Library → Requests</b>.",
  "When a librarian <b>approves</b>, the loan starts at once, you receive a notification with your <b>due date</b>, and the book appears under <b>My Library → Current</b>. Collect the book at the circulation desk.",
  "If the request is <b>declined</b>, you receive a notification and the librarian's reason is shown in the Requests tab. You may request the title again.",
  "Changed your mind? Use <b>Withdraw</b> on a pending request.",
])}
${fig("student-request-pending", "After sending a request the button turns into a pending-approval badge.")}
${note("A request is refused straight away if you have reached your borrowing limit, owe more than the fine threshold, already have a pending request for the same title, or no copy is available. The message tells you which.")}

<h3>3.5 AI Smart Search</h3>
<p>Ordinary search matches words. <b>AI Smart Search</b> understands meaning: describe what you need — for example
<i>"learning to program in Python for beginners"</i> — and the system ranks books by how close they are in meaning,
with a short <b>reason</b> for each result.</p>
${steps([
  "Open <b>AI Smart Search</b> (or press the purple button on the Catalogue page).",
  "Type a sentence describing the topic, level or goal, then press <b>Enter</b>.",
  "Read the reason under each result and open the best match.",
])}
${fig("student-ai-search", "Results are ordered by relevance, each with a plain-language reason.")}

<h3>3.6 The AI Assistant</h3>
<p>The assistant answers questions about the library. It is <b>grounded</b>: library rules and hours come from the
library's own knowledge base, and anything about <i>you</i> (loans, due dates, fines, reservations) comes from your account
records — never invented, and never anyone else's data.</p>
${table(["You can ask", "Example"], [
  ["Library rules", "How many books can I borrow? How long is the loan period? What is the fine for a late book?"],
  ["Opening hours &amp; contact", "What are the library hours?"],
  ["Your account", "Which books do I have and when are they due? Do I have any fines?"],
  ["Finding books", "Do you have books on machine learning?"],
])}
${fig("student-assistant-answer", "A grounded answer. Sources are listed so you can see where the information came from.")}
<p>You can also use the assistant from <b>any page</b>: press the round ✦ button at the bottom right. The chat stays open
as you move between pages; <b>Full view ↗</b> opens the dedicated page and <b>Esc</b> closes the pop-up.</p>
${fig("student-chat-widget", "The floating chat pop-up with quick-start questions.")}
${note("The assistant limits how many questions each person can ask per minute, and only answers library topics. For anything it cannot answer it suggests contacting the library desk.")}
${note("<b>Demo build:</b> it uses a built-in <i>mock</i> language model, so replies show the retrieved facts (your loans, the library policies) as plain text, with source chips underneath. When an administrator connects a real AI provider the same facts are phrased as fluent sentences; the sources and the rule that answers come only from library data do not change.")}

<h3>3.7 My Library</h3>
<p>Everything personal lives under <b>My Library</b>. The cards at the top show your loans against your limit, any
outstanding fines, and whether you are currently allowed to borrow. The tabs below break it down:</p>
${fig("student-my-library-current", "Current loans with due dates (green = comfortable, amber = soon, red = overdue). Use Renew to extend.")}
${table(["Tab", "Shows", "What you can do"], [
  ["<b>Current</b>", "Books you hold, issue and due dates, times renewed", "<b>Renew</b> — extends the due date. Limited number of times, and not possible while another member is waiting for the title (see Chapter 6)."],
  ["<b>Requests</b>", "Your borrow requests and their status", "<b>Withdraw</b> a pending request; read a decline reason."],
  ["<b>Reservations</b>", "Your place in each queue and hold deadlines", "<b>Cancel</b> a reservation."],
  ["<b>Fines</b>", "Charges, amounts paid and status", "Read only. Fines are paid at the circulation desk."],
  ["<b>History</b>", "Books you have returned", "Look up what you borrowed before."],
])}
${fig("student-my-library-requests", "Requests tab: status of each request and the librarian's note if declined.")}
${fig("student-my-library-reservations", "Reservations tab: queue position and the date a held copy must be collected by.")}
${fig("student-my-library-fines", "Fines tab. Large unpaid fines block new borrowing until they are paid or waived.")}
${fig("student-my-library-history", "History tab: everything you have returned.")}
${warn("Renewal is refused once you have used all your renewals, <b>or when another member has reserved the title</b> (so the next person is not kept waiting). Return the book and, if you still need it, request it again.")}

<h3>3.8 Quick jump with Ctrl+K (⌘K on Mac)</h3>
<p>Press <b>Ctrl&nbsp;K</b> anywhere (or click the <b>Search</b> chip). Start typing a page name — <i>fines</i>, <i>favorites</i>,
<i>profile</i> — and press <b>Enter</b>. Typing two or more letters also offers <i>Search the catalogue for…</i> and
<i>Ask the AI assistant…</i>. Use ↑ ↓ to move and <b>Esc</b> to close.</p>
${fig("student-command-palette", "The command palette: every page, plus theme and sign-out actions, one keystroke away.")}

<h3>3.9 Reservations</h3>
<p>When every copy of a title is on loan, <b>Reserve</b> adds you to a first-come queue.</p>
${flow(["You reserve — queue position #n", "A copy is returned", "You become <b>Ready</b> and are notified", "Collect within the hold time (default 48 h)", "Borrow it — reservation fulfilled"])}
${bullets([
  "If you do not collect within the hold window the reservation <b>expires</b> and the copy goes to the next person.",
  "You cannot reserve a title that is available now — use <b>Request to borrow</b> instead.",
  "You can have only one active reservation per title.",
])}

<h3>3.10 Favorites, notifications and profile</h3>
${fig("student-favorites", "Favorites — a personal reading list. Click a title to open it.")}
${fig("student-notifications", "Notifications — approved/declined requests, reservation-ready and due-date alerts. Mark individual items or all as read.")}
${fig("student-profile", "Profile — update your name and phone, and change your password.")}
${bullets([
  "<b>Change password:</b> enter your current password and a new one (at least 8 characters). All your other sessions are signed out.",
  "<b>Forgot your password?</b> Ask the library desk or an administrator to reset it.",
])}

<h3>3.11 The in-app guide</h3>
<p>The <b>How to use</b> page in the sidebar is a short, role-aware version of this document, with links that jump straight to each feature.</p>
${fig("student-in-app-guide", "The built-in 'How to use' page.")}

<h3>3.12 Faculty accounts</h3>
${fig("faculty-dashboard", "A faculty dashboard. The pages are the same as a student's; the allowances are larger.")}
<p>Faculty use exactly the same pages as students. The differences are policy: a <b>longer loan period</b> and a
<b>higher borrowing limit</b> (see Chapter 6 for the numbers).</p>
`);

chapter("librarian", "Librarian guide", ["librarian", "admin"], `
<p>Librarians (and administrators) have every member feature <i>plus</i> a <b>Librarian</b> section in the sidebar:
Circulation Desk, Loans &amp; Returns, Approvals, Reservations, Fines, Books, Inventory, Shelves and Categories.
A red number beside <b>Approvals</b> is the count of requests waiting for you.</p>
${fig("librarian-dashboard", "The librarian dashboard: today's circulation, overdue items, pending requests and fines at a glance.")}

<h3>4.1 Approving borrow requests ${badge("librarian", "admin")}</h3>
<p>Members ask for available books from the book page; you decide here.</p>
${fig("librarian-approvals", "Approvals: each row shows the member, the book, when it was requested and its status.")}
${steps([
  "Open <b>Approvals</b>. The <b>Awaiting decision</b> tab lists pending requests, oldest first by date.",
  "Press <b>✓ Approve</b> to issue the loan immediately. The system re-checks that a copy is free, the member is under their limit and not blocked by fines; if not, you see the reason and the request stays pending.",
  "Or press <b>Decline</b>, type a reason the member will see, and confirm with <b>Decline request</b>.",
  "Use the <b>Approved</b>, <b>Declined</b> and <b>All</b> tabs to review past decisions.",
])}
${fig("librarian-decline-dialog", "Declining asks for a reason, which is shown to the member.")}
${fig("librarian-approved", "After approval a confirmation appears and the request leaves the pending list.")}
${tip("Approval issues the loan system-side right away. Hand the physical book to the member at the desk; the due date has already started.")}

<h3>4.2 The Circulation Desk — issue and return ${badge("librarian", "admin")}</h3>
<p>Use the desk for walk-up service. It has two tabs: <b>Issue</b> and <b>Return</b>.</p>
${fig("librarian-circulation", "The desk starts with step 1 — find the member.")}
<b>Issuing a book</b>
${steps([
  "Type the member's name, email or roll number and press <b>Search</b>, then <b>Select</b> the right person.",
  "A summary bar shows loans against limit, outstanding fines and whether they are <b>Eligible</b> or <b>Blocked</b>.",
  "Their current loans are listed with a quick <b>Return</b> button.",
  "Search for the book in step 2 and press <b>Issue</b> beside a title that has copies available. A celebration animation and a message confirm the due date.",
])}
${fig("librarian-circulation-member", "A selected member with eligibility, current loans and the book search.")}
<b>Returning a book</b>
${steps([
  "Open the <b>Return</b> tab, scan or type the <b>copy barcode</b> and press <b>Return</b>.",
  "If the book is late, the system calculates the overdue fine and tells you the amount; it is added to the member's fines automatically.",
  "If someone is next in the reservation queue, they are promoted to <b>Ready</b> and notified.",
])}
${fig("librarian-circulation-return", "Return by barcode. 'No issued copy with that barcode' means the copy is not currently on loan.")}

<h3>4.3 Loans &amp; Returns ${badge("librarian", "admin")}</h3>
<p>Every loan in one table. Filter by <b>On loan</b>, <b>Overdue</b>, <b>Returned</b> or <b>All</b>; search by title; <b>Renew</b> or <b>Return</b> any loan inline. Each row shows the member's name and ID.</p>
${fig("librarian-loans", "All loans with member, due date and inline actions.")}
${fig("librarian-loans-overdue", "The Overdue filter is your daily follow-up list.")}

<h3>4.4 Reservations ${badge("librarian", "admin")}</h3>
<p>The hold queue per title. <b>Ready for pickup</b> means a copy is waiting for that member at the desk. You can cancel a hold if needed; the queue re-numbers itself.</p>
${fig("librarian-reservations", "Reservations: queue position, hold deadline and status.")}

<h3>4.5 Fines ${badge("librarian", "admin")}</h3>
${fig("librarian-fines", "Fines are grouped as Outstanding, Paid, Waived or All.")}
${steps([
  "<b>Record a payment:</b> press <b>Pay</b>, confirm the amount (partial payments are allowed) and choose a method — cash, UPI, card or adjustment — then <b>Record</b>.",
  "<b>Waive a fine:</b> press <b>Waive</b>, type a reason and confirm. The reason is saved in the audit trail.",
])}
${fig("librarian-fine-payment", "Recording a payment. The outstanding balance is shown for reference.")}
${fig("librarian-fine-waive", "A waiver always needs a reason.")}
${warn("Waiving cannot be undone from the screen. Record the reason carefully — it appears in the audit log.")}
<p>Fines are created automatically for late returns (a per-day rate, see Chapter 6). Lost or damaged items are charged as <b>manual fines</b>.</p>

<h3>4.6 Books ${badge("librarian", "admin")}</h3>
${fig("librarian-books", "Book management: search, edit, add copies, archive.")}
${steps([
  "Press <b>Add book</b> (top right), fill in the title, authors, ISBN, category, publisher, year and so on.",
  "Enter <b>initial copies</b> to create the physical copies and barcodes at the same time.",
  "<b>Edit</b> corrects any detail. <b>Archive</b> hides a title from the catalogue — not allowed while a copy is on loan.",
])}
${fig("librarian-add-book", "The add-book form. A duplicate ISBN is rejected.")}
${note("New and edited books are re-indexed for AI search automatically, so they appear in AI Smart Search straight away.")}

<h3>4.7 Inventory (copies) ${badge("librarian", "admin")}</h3>
<p>Every physical copy with its barcode, condition, status and shelf. Edit a copy to change its <b>status</b> (available, damaged, lost…), <b>condition</b>, <b>shelf</b> or notes. A copy marked damaged or lost is no longer counted as available.</p>
${fig("librarian-inventory", "Inventory: one row per physical copy.")}

<h3>4.8 Shelves ${badge("librarian", "admin")}</h3>
<p>Create shelves with a code, name, location and capacity, then assign copies to them. A shelf that still holds copies cannot be deleted.</p>
${fig("librarian-shelves", "Shelf register with location and capacity.")}

<h3>4.9 Categories, publishers and authors ${badge("librarian", "admin")}</h3>
<p>Maintain the lists used when cataloguing. A category or publisher that is in use by any book cannot be deleted — reassign those books first.</p>
${fig("librarian-taxonomy", "Categories, publishers and authors in one place.")}
`);

chapter("admin", "Administrator guide", ["admin"], `
<p>Administrators have everything in Chapters 3 and 4 plus an <b>Admin</b> section with Users, Departments, Reports, Settings and Audit Log.</p>
${fig("admin-dashboard", "The administrator dashboard adds system-wide totals and trends.")}

<h3>5.1 Users — adding and managing accounts</h3>
${fig("admin-users", "Users list: search by name, email or ID; filter by role or status.")}
<b>Adding a user</b>
${steps([
  "Press <b>+ Add user</b>.",
  "Enter the <b>Email</b>, a <b>Temporary password</b> (at least 8 characters) and the <b>Full name</b>.",
  "Pick the <b>Role</b> (student, faculty, librarian, administrator); optionally the identifier (roll / employee number), phone and department.",
  "Press <b>Save</b>. The account is active immediately. Share the temporary password securely and ask the person to change it from their Profile page.",
])}
${fig("admin-add-user", "The Add user dialog.")}
${note("If saving fails, the message tells you exactly why — for example <i>password: String should have at least 8 characters</i> or <i>Email already registered</i>.")}
<b>Editing a user</b>
${steps([
  "Press <b>Edit</b> on the row.",
  "Change the <b>role</b>, <b>status</b> (<i>active</i>, <i>suspended</i>, <i>pending</i>), name, identifier, phone or department.",
  "<b>Borrow limit override</b> gives one person a different limit from their role's default (leave blank to use the default).",
  "<b>Staff notes</b> are private notes visible to staff only. Press <b>Save</b>.",
])}
${fig("admin-edit-user", "Editing a user: role, status, borrow limit override and staff notes.")}
<b>Resetting a password</b>
${steps(["Press <b>Reset PW</b>, enter a new password (8+ characters) and confirm. The person is signed out everywhere and must sign in with the new password."])}
${fig("admin-reset-password", "Reset password dialog.")}
${warn("<b>Suspended</b> users cannot sign in and existing sessions stop working. Suspend rather than delete — their loan and fine history is kept.")}

<h3>5.2 Departments</h3>
<p>Departments group members for reporting. Add, rename or remove them; a department that still has members cannot be deleted.</p>
${fig("admin-departments", "Department register.")}

<h3>5.3 Reports</h3>
<p>Four report tabs with a period selector (7 days, 30 days, 90 days, 1 year):</p>
${table(["Tab", "Answers"], [
  ["<b>Circulation</b>", "How many books were issued, returned and renewed; fines raised and collected."],
  ["<b>Most borrowed</b>", "Which titles are in highest demand."],
  ["<b>Inventory</b>", "Holdings by status and category."],
  ["<b>Overdue</b>", "Every overdue loan and who holds it."],
])}
${fig("admin-reports", "Circulation summary for the chosen period.")}
${fig("admin-reports-popular", "Most-borrowed titles — useful for buying decisions.")}

<h3>5.4 Settings — library policy</h3>
<p>Every institutional number lives here, not in code. The page is split into cards, each value with its own <b>Save</b> button:</p>
${table(["Card", "What you can set"], [
  ["<b>Loan periods &amp; borrowing limits</b>", "Loan length (days) and how many books at once — one number for each of Student, Faculty, Librarian and Admin."],
  ["<b>Loans &amp; renewals</b>", "Maximum renewals per loan, days added per renewal, grace period."],
  ["<b>Fines</b>", "Currency code, overdue fine per day, lost-book flat fine, damage fine."],
  ["<b>Reservations</b>", "Hold window in hours."],
  ["<b>Library information</b>", "Opening hours and contact email — quoted by the AI assistant."],
  ["<b>AI</b>", "Switch semantic search and the AI assistant on or off."],
])}
<p>Changes apply to <b>new</b> actions immediately — loans already issued keep their original due dates. A value of the wrong kind (for example text where a number is needed, or a loan period of 0) is rejected with a message.</p>
${fig("admin-settings", "Policy settings. Edit a value and save; every change is recorded in the audit log.")}
${tip("Library hours and contact email in Settings are what the AI assistant quotes. Keep them current so students get correct answers.")}

<h3>5.5 Audit log</h3>
<p>A tamper-evident trail of who did what and when: sign-ins, lockouts, loans, returns, fines, waivers, approvals, user changes and settings changes.</p>
${fig("admin-audit", "The audit log.")}
`);

chapter("policy", "Policies &amp; defaults", [], `
<p>These are the <b>default</b> values shipped with the system. An administrator can change them in <b>Admin → Settings</b>.</p>
${table(["Policy", "Student", "Faculty", "Librarian / Admin"], [
  ["Loan period", "14 days", "30 days", "30 days"],
  ["Borrowing limit (books at once)", "4", "10", "10"],
  ["Renewals allowed", "2", "2", "2"],
  ["Each renewal adds", "7 days", "7 days", "7 days"],
])}
${table(["Rule", "Default"], [
  ["Overdue fine", "₹2.00 per day late"],
  ["Lost book (flat charge)", "₹500.00"],
  ["Damage charge", "₹100.00"],
  ["Borrowing blocked when unpaid fines exceed", "₹250.00 (half the lost-book charge)"],
  ["Reservation hold time", "48 hours after a copy becomes ready"],
  ["Failed sign-ins before lock-out", "5 attempts → 15-minute lock"],
  ["Renewal blocked when", "another member is queued for, or has a copy held of, the same title"],
  ["Password length", "8 characters minimum"],
])}
<p>Individual members can have a custom <b>borrow limit override</b> set by an administrator.</p>
`);

chapter("playbooks", "Everyday playbooks", ["librarian", "admin"], `
<h3>Onboarding a new student</h3>
${steps(["Admin: <b>Admin → Users → + Add user</b> (role <i>student</i>) — or the student self-registers.", "Student signs in and changes the password from <b>Profile</b>.", "Student searches the catalogue and sends a <b>Request to borrow</b>."])}
<h3>Start of the day</h3>
${steps(["Open <b>Approvals</b> — clear the pending requests.", "Open <b>Loans &amp; Returns → Overdue</b> — follow up with late borrowers.", "Open <b>Reservations → Ready for pickup</b> — check held copies are on the hold shelf."])}
<h3>A student returns a late book</h3>
${steps(["<b>Circulation Desk → Return</b>, scan the barcode.", "Note the fine shown. Open <b>Fines</b>, press <b>Pay</b> when the student pays, or <b>Waive</b> with a reason if appropriate."])}
<h3>A book is lost or damaged</h3>
${steps(["<b>Inventory</b> → edit the copy → set status to <b>lost</b> or <b>damaged</b>.", "Raise the charge as a manual fine; record the payment when received."])}
<h3>A new title arrives</h3>
${steps(["<b>Books → Add book</b> with <b>initial copies</b>.", "<b>Inventory</b> → assign each copy to its <b>shelf</b>."])}
<h3>A member cannot borrow</h3>
${steps(["On the Circulation Desk, select the member and read the summary bar: <b>Blocked</b> means limit reached or fines above the threshold.", "Return a book, collect or waive the fine, or (admin) set a <b>borrow limit override</b>."])}
`);

chapter("help", "Troubleshooting &amp; FAQ", [], `
${table(["Problem", "Why it happens / what to do"], [
  ["I cannot sign in", "Check the email and password. After 5 failures the account locks for 15 minutes. Ask an administrator to reset your password."],
  ["There is no Request to borrow button", "Every copy is on loan — use <b>Reserve</b>. Staff accounts do not see the request button; staff issue at the desk."],
  ["My request was refused immediately", "You are at your borrowing limit, owe fines above the threshold, or already have a pending request for the title. The message says which."],
  ["Approve failed for a librarian", "The member reached their limit or became blocked after asking, or the last copy was taken. Decline with a reason or ask the member to return something."],
  ["I cannot renew", "You have used all renewals, the loan is not active, or another member is waiting for the title. Return the book."],
  ["I do not see Admin or Librarian pages", "Those sections only appear for those roles; opening their addresses as a student sends you back to the dashboard."],
  ["The AI assistant says it cannot answer", "It only answers library topics and your own account. Rephrase, or contact the library desk."],
  ["The AI assistant is unavailable", "An administrator may have switched it off in Settings, or you asked too many questions in a minute. Wait and try again."],
  ["The page looks wrong or stale", "Refresh the browser (Ctrl+F5). If you are signed out unexpectedly your session expired — sign in again."],
  ["Animations are missing", "Your computer is set to <i>Reduce motion</i>; the app respects that. The app works the same without them."],
])}
<h3>Glossary</h3>
${table(["Term", "Meaning"], [
  ["Copy", "One physical item of a title, with its own barcode."],
  ["Loan", "A copy issued to a member until a due date."],
  ["Borrow request", "A member's ask to borrow an available title, awaiting librarian approval."],
  ["Reservation", "A place in the queue for a title that is fully on loan."],
  ["Hold / Ready", "A returned copy set aside for the next person in the queue."],
  ["Fine", "A charge for late return, loss or damage."],
  ["Waive", "Cancel a fine, with a recorded reason."],
  ["Semantic search", "Search by meaning rather than exact words."],
])}
`);

chapter("setup", "Appendix — running the demo locally", ["admin"], `
<p>For the person who installs and maintains the application. Full instructions are in the project <code>README.md</code>.</p>
${table(["Part", "Command (from the project folder)", "Address"], [
  ["Backend (API)", "<code>cd backend</code> then <code>.venv\\Scripts\\python.exe -m uvicorn app.main:app --port 8000</code>", "http://localhost:8000/docs"],
  ["Frontend (website)", "<code>cd frontend</code> then <code>npm run dev</code>", "http://localhost:5180"],
  ["Reset demo data", "<code>cd backend</code> then <code>.venv\\Scripts\\python.exe -m scripts.seed --reset</code>", "—"],
  ["Automated tests", "<code>pytest</code> (backend) and <code>npx playwright test</code> (frontend)", "—"],
])}
${note("The demo build uses SQLite and a built-in mock AI so it runs without internet or paid services. All books, members and loans in it are fictional.")}
`);

// ------------------------------------------------------------------ assemble
let pageOf = {};
const buildToc = () => chapters.map((c, i) => {
  const n = i + 1;
  const who = c.who.length ? ` <span class="tocwho">${c.who.map((w) => `<span class="pill ${w}">${persona[w]}</span>`).join(" ")}</span>` : "";
  const pg = pageOf[c.id] ? `<span class="tocpg">${pageOf[c.id]}</span>` : "";
  return `<li><a href="#${c.id}"><span>${n}. ${c.title}</span></a>${who}${pg}</li>`;
}).join("");

const body = chapters.map((c, i) => `
<section class="chapter" id="${c.id}">
  <div class="chhead"><span class="chnum">Chapter ${i + 1}</span><h1>${c.title}</h1>
  <div>${c.who.map((w) => `<span class="pill ${w}">${persona[w]}</span>`).join(" ")}</div></div>
  ${c.body}
</section>`).join("");

const css = `
@page { size: A4; margin: 18mm 15mm 18mm 15mm; }
@page :first { margin: 0; }
:root { --brand:#0f5964; --brand2:#5b3fc4; --ink:#17212b; --mute:#5d6b78; --line:#dbe3ea; --bg:#f4f7fa; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 "Segoe UI", system-ui, Arial, sans-serif; color: var(--ink); margin: 0; }
code { font: 9.5pt Consolas, monospace; background: #eef2f6; padding: 1px 5px; border-radius: 4px; }
h1 { font-size: 24pt; margin: 0; color: var(--brand); line-height: 1.15; }
h3 { font-size: 13pt; margin: 20px 0 6px; color: var(--brand); break-after: avoid; }
p { margin: 6px 0 8px; } ul, ol { margin: 6px 0 10px; padding-left: 22px; } li { margin: 3px 0; }
a { color: inherit; text-decoration: none; }
.cover { display: flex; flex-direction: column; justify-content: center; page-break-after: always;
  background: linear-gradient(135deg, #0f5964 0%, #5b3fc4 100%); color: #fff; margin: 0; padding: 28mm 22mm; width: 210mm; height: 297mm; }
.cover .mark { width: 62px; height: 62px; border-radius: 16px; background: rgba(255,255,255,.18); display: grid; place-items: center;
  font: 700 26pt Georgia, serif; margin-bottom: 26px; border: 2px solid rgba(255,255,255,.5); }
.cover h1 { color: #fff; font-size: 38pt; } .cover .sub { font-size: 16pt; opacity: .9; margin: 10px 0 30px; }
.cover .meta { font-size: 10.5pt; opacity: .85; line-height: 1.8; }
.cover .who { margin-top: 36px; display: flex; gap: 10px; flex-wrap: wrap; }
.cover .who span { background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.4); padding: 5px 14px; border-radius: 999px; font-size: 10pt; }
.toc { page-break-after: always; } .toc h1 { margin-bottom: 14px; }
.toc ol { list-style: none; padding: 0; counter-reset: x; } .toc li { padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 12pt; display: flex; justify-content: space-between; align-items: center; }
.tocwho { display: flex; gap: 4px; margin-left: auto; margin-right: 14px; } .tocpg { min-width: 22px; text-align: right; color: var(--mute); }
.chapter { page-break-before: always; }
.chhead { border-bottom: 3px solid var(--brand); padding-bottom: 10px; margin-bottom: 14px; }
.chnum { text-transform: uppercase; letter-spacing: .12em; font-size: 8.5pt; color: var(--mute); font-weight: 600; }
.pill { display: inline-block; font-size: 7.5pt; font-weight: 600; padding: 1px 8px; border-radius: 999px; margin-right: 2px; vertical-align: middle; color: #fff; }
.pill.student { background: #2f7d5b; } .pill.faculty { background: #2d6cb5; } .pill.librarian { background: #b5702d; } .pill.admin { background: #8a3fb5; }
figure { margin: 12px 0 14px; break-inside: avoid; text-align: center; }
figure img { max-width: 94%; max-height: 112mm; width: auto; height: auto; border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 2px 10px rgba(20,40,60,.12); }
figcaption { font-size: 8.5pt; color: var(--mute); margin-top: 6px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9.5pt; break-inside: auto; }
th { background: var(--brand); color: #fff; text-align: left; padding: 6px 9px; font-weight: 600; }
td { padding: 6px 9px; border-bottom: 1px solid var(--line); vertical-align: top; } tr { break-inside: avoid; } tr:nth-child(even) td { background: var(--bg); }
.callout { border-left: 4px solid; border-radius: 6px; padding: 8px 12px; margin: 10px 0; break-inside: avoid; font-size: 9.8pt; }
.callout b { display: block; text-transform: uppercase; letter-spacing: .08em; font-size: 7.8pt; margin-bottom: 2px; }
.tip { background: #e8f5ee; border-color: #2f7d5b; } .tip b { color: #2f7d5b; }
.note { background: #e9f1fb; border-color: #2d6cb5; } .note b { color: #2d6cb5; }
.warn { background: #fdf1e3; border-color: #c9821f; } .warn b { color: #b06d12; }
.callout-inline { padding: 0 6px; border-radius: 4px; font-weight: 600; font-size: 9pt; } .callout-inline.tip { color: #2f7d5b; } .callout-inline.warn { color: #b06d12; }
ol.steps { counter-reset: s; list-style: none; padding-left: 0; } ol.steps li { counter-increment: s; position: relative; padding-left: 30px; margin: 6px 0; break-inside: avoid; }
ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 1px; width: 21px; height: 21px; border-radius: 50%; background: var(--brand); color: #fff; font-size: 8.5pt; font-weight: 700; display: grid; place-items: center; }
.flow { display: flex; align-items: stretch; gap: 6px; margin: 10px 0 14px; flex-wrap: wrap; break-inside: avoid; }
.flow .node { flex: 1; min-width: 80px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px 8px; font-size: 9pt; text-align: center; display: flex; align-items: center; justify-content: center; }
.flow .arrow { align-self: center; color: var(--brand); font-weight: 700; }
`;

const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const makeHtml = () => `<!doctype html><html><head><meta charset="utf-8"><title>KLE Institute AI Library — User Guide</title><style>${css}</style></head><body>
<section class="cover"><div class="mark">KL</div><h1>KLE Institute<br>AI Library</h1>
<div class="sub">User Guide for students, faculty, librarians and administrators</div>
<div class="meta">Version 1.0 · ${today}<br>Covers: catalogue &amp; AI search · borrow requests &amp; approvals · circulation · fines · inventory · administration</div>
<div class="who"><span>Student</span><span>Faculty</span><span>Librarian</span><span>Administrator</span></div></section>
<section class="toc"><h1>Contents</h1><ol>${buildToc()}</ol>
<p class="muted" style="margin-top:22px;color:var(--mute);font-size:9.5pt">Screens shown are from the demo build with fictional data.</p></section>
${body}</body></html>`;

const out = join(here, "KLE-Library-User-Guide.pdf");
const footer = `<div style="width:100%;font-size:8px;color:#8a97a3;padding:0 15mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial"><span>KLE Institute AI Library — User Guide</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage();
async function render() {
  writeFileSync(join(here, "user-guide.html"), makeHtml());
  await page.goto(pathToFileURL(join(here, "user-guide.html")).href);
  await page.waitForLoadState("load");
  await page.pdf({
    path: out, format: "A4", printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: "<div></div>", footerTemplate: footer,
  });
}

// Pass 1 renders without page numbers; pass 2 fills the contents with real ones.
await render();
const py = `
import json, sys
from pypdf import PdfReader
r = PdfReader(sys.argv[1]); n = int(sys.argv[2]); res = {}
for i, pg in enumerate(r.pages):
    t = pg.extract_text() or ""
    for k in range(1, n + 1):
        if str(k) not in res and ("CHAPTER %d" % k) in t.upper().replace("
", " ") and i >= 2:
            res[str(k)] = i + 1
print(json.dumps(res))`;
try {
  const found = JSON.parse(execFileSync("python", ["-c", py, out, String(chapters.length)]).toString());
  chapters.forEach((c, i) => { if (found[String(i + 1)]) pageOf[c.id] = found[String(i + 1)]; });
  await render();
} catch (e) {
  console.warn("Contents page numbers skipped:", String(e.message).split("
")[0]);
}
await browser.close();
console.log(`PDF written: ${out}`);
console.log(`Chapter pages: ${JSON.stringify(pageOf)}`);
console.log(`Figures: ${figNo}. Missing screenshots: ${missing.length ? missing.join(", ") : "none"}`);
