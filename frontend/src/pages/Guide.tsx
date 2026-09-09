import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AiBadge, PageHeader } from "../components/ui";

interface Item {
  title: string;
  to?: string;
  body: string;
  ai?: boolean;
}
interface Section {
  heading: string;
  intro?: string;
  items: Item[];
}

const EVERYONE: Section[] = [
  {
    heading: "Find something to read",
    items: [
      {
        title: "Catalogue",
        to: "/catalogue",
        body: "Browse the whole collection. Filter by category, tick “Available only” to hide books that are all out on loan, and page through results. Open any book for full details, its physical copies, and where it sits on the shelf.",
      },
      {
        title: "AI Smart Search",
        to: "/ai-search",
        ai: true,
        body: "Type what you want in plain English — “beginner books on machine learning”, “cybersecurity about web attacks”. Switch between Hybrid, AI-semantic and Keyword. Every result explains why it matched.",
      },
      {
        title: "AI Library Assistant",
        to: "/assistant",
        ai: true,
        body: "Ask about the catalogue, your own loans and fines, or library policy. Answers are grounded in the library’s data and show their sources. It never sees another member’s information and can’t change anything for you.",
      },
      {
        title: "Favorites",
        to: "/favorites",
        body: "Tap “☆ Save” on any book to keep it here for later.",
      },
    ],
  },
  {
    heading: "Borrow, renew and reserve",
    intro:
      "Books are issued and returned at the circulation desk. Everything else you can do yourself.",
    items: [
      {
        title: "My Library → Current",
        to: "/my-library",
        body: "See what you have on loan and when it’s due. A coloured badge tells you how many days are left (or how overdue it is). Hit “Renew” to extend — up to the limit set by the library, and only if nobody is waiting for the title.",
      },
      {
        title: "Reserve a title",
        to: "/catalogue",
        body: "If every copy of a book is on loan, open its page and press “Reserve”. You join the queue; when a copy is returned the next person is notified and the copy is held for them for a set time.",
      },
      {
        title: "My Library → Reservations / Fines / History",
        to: "/my-library",
        body: "Track your place in each queue, review any fines and how they were settled, and see everything you’ve ever borrowed.",
      },
    ],
  },
  {
    heading: "Stay in the loop",
    items: [
      {
        title: "Notifications",
        to: "/notifications",
        body: "Due-date reminders, overdue alerts, “your reservation is ready”, fine notices and library announcements. The bell in the top bar shows unread count.",
      },
      {
        title: "Profile",
        to: "/profile",
        body: "Update your name and phone number, and change your password.",
      },
      {
        title: "Light / dark theme",
        body: "Use the ☾ / ☀ button in the top bar. Your choice is remembered on this device.",
      },
    ],
  },
];

const LIBRARIAN: Section[] = [
  {
    heading: "The circulation desk",
    items: [
      {
        title: "Circulation Desk",
        to: "/staff/circulation",
        body: "Issue: find the member, check their borrowing status, then find the book and issue it. A quick-return list of that member’s loans appears so you can take returns in the same flow. Return: also accepts a copy barcode directly.",
      },
      {
        title: "Loans & Returns",
        to: "/staff/loans",
        body: "Every loan in one table. Filter by On loan / Overdue / Returned / All, search by title, and renew or return any loan inline. Member name and ID are shown on each row.",
      },
      {
        title: "Reservations",
        to: "/staff/reservations",
        body: "The hold queue for every title. “Ready for pickup” means a copy is waiting at the desk. Cancel a hold if needed — the queue re-sequences automatically.",
      },
      {
        title: "Fines",
        to: "/staff/fines",
        body: "Record a payment (full or partial, with a method), waive a fine with a reason (logged to the audit trail), or raise a manual fine for a lost or damaged item.",
      },
    ],
  },
  {
    heading: "Manage the collection",
    items: [
      {
        title: "Books",
        to: "/staff/books",
        body: "Add a new title (it’s indexed for AI search automatically) or archive one that’s no longer stocked. Archiving is blocked while copies are on loan.",
      },
      {
        title: "Inventory",
        to: "/staff/inventory",
        body: "Every physical copy. Search by title or barcode, filter by status, and edit a copy — change its status, move it to another shelf, update condition, price or notes.",
      },
      {
        title: "Shelves",
        to: "/staff/shelves",
        body: "Create and edit shelves with a location and capacity, see how full each one is, and list the copies stored on it.",
      },
      {
        title: "Categories, Publishers & Authors",
        to: "/staff/taxonomy",
        body: "Rename, merge intent, or tidy up the taxonomy. Deleting a category or publisher is blocked while books still use it.",
      },
    ],
  },
];

const ADMIN: Section[] = [
  {
    heading: "Run the system",
    items: [
      {
        title: "Users",
        to: "/admin/users",
        body: "Filter by role or status. Create staff accounts, edit a member’s role, suspend or reactivate them, set a per-member borrowing-limit override, add private staff notes, or reset a password. You can’t change your own role.",
      },
      {
        title: "Departments",
        to: "/admin/departments",
        body: "Add and edit the academic departments members belong to.",
      },
      {
        title: "Settings",
        to: "/admin/settings",
        body: "Every policy value lives here — loan periods and borrowing limits per role, fine rates, the reservation hold window, library hours and contact details, and switches to turn AI search or the assistant on and off. Changes apply immediately.",
      },
      {
        title: "Reports",
        to: "/admin/reports",
        body: "Circulation summary over 7 / 30 / 90 / 365 days, most-borrowed titles, an inventory breakdown by status and category, and the current overdue list.",
      },
      {
        title: "Audit Log",
        to: "/admin/audit",
        body: "A record of every security-relevant and data-changing action. Filter by an action prefix such as loan., fine. or admin.",
      },
    ],
  },
];

function SectionCard({ s }: { s: Section }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>{s.heading}</h2>
      </div>
      <div className="card-body stack-sm">
        {s.intro && <p className="muted small">{s.intro}</p>}
        {s.items.map((it) => (
          <div
            key={it.title}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="row-tight" style={{ marginBottom: 3 }}>
              {it.to ? (
                <Link to={it.to} style={{ fontWeight: 700, fontSize: 14 }}>
                  {it.title}
                </Link>
              ) : (
                <strong style={{ fontSize: 14 }}>{it.title}</strong>
              )}
              {it.ai && <AiBadge />}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Guide() {
  const { user } = useAuth();
  const staff = user?.role === "librarian" || user?.role === "admin";
  const admin = user?.role === "admin";

  return (
    <>
      <PageHeader
        title="How to use the platform"
        sub="Everything you can do here, grouped by what you're trying to get done."
      />

      <div className="callout ai" style={{ marginBottom: 18 }}>
        <strong>The database is always the source of truth.</strong> AI features
        help you discover and understand things, but availability, due dates,
        fines and reservations are only ever confirmed against real records — the
        assistant will tell you when it can't verify something.
      </div>

      <div className="stack">
        {EVERYONE.map((s) => (
          <SectionCard key={s.heading} s={s} />
        ))}

        {staff && (
          <>
            <h2 style={{ marginTop: 8 }}>For librarians</h2>
            {LIBRARIAN.map((s) => (
              <SectionCard key={s.heading} s={s} />
            ))}
          </>
        )}

        {admin && (
          <>
            <h2 style={{ marginTop: 8 }}>For administrators</h2>
            {ADMIN.map((s) => (
              <SectionCard key={s.heading} s={s} />
            ))}
          </>
        )}
      </div>
    </>
  );
}
