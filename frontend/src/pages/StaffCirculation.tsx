import { useState } from "react";
import { api } from "../api/client";
import { useMutation } from "../lib/useApi";
import { ErrorBox, Toast, fmtDate } from "../components/ui";
import type { BorrowingStatus, Loan, Page, User } from "../api/types";

interface ReturnResult {
  loan: Loan;
  fine: { amount: number; type: string } | null;
  message: string;
}

export default function StaffCirculation() {
  const [tab, setTab] = useState<"issue" | "return">("issue");
  const [toast, setToast] = useState<{ m: string; t: "ok" | "err" } | null>(
    null,
  );

  // --- Issue ---
  const [memberQ, setMemberQ] = useState("");
  const [members, setMembers] = useState<User[]>([]);
  const [member, setMember] = useState<User | null>(null);
  const [status, setStatus] = useState<BorrowingStatus | null>(null);
  const [bookQ, setBookQ] = useState("");
  const [books, setBooks] = useState<Page<{ id: string; title: string; available_copies: number }> | null>(null);

  const findMembers = useMutation((q: string) =>
    api<User[]>(`/users?q=${encodeURIComponent(q)}`),
  );
  const findBooks = useMutation((q: string) =>
    api<Page<{ id: string; title: string; available_copies: number }>>(
      `/books?q=${encodeURIComponent(q)}&available_only=true&page_size=8`,
    ),
  );
  const issue = useMutation((memberId: string, bookId: string) =>
    api<Loan>("/issues", {
      method: "POST",
      body: { member_id: memberId, book_id: bookId },
    }),
  );

  async function pickMember(m: User) {
    setMember(m);
    setMembers([]);
    setMemberQ(m.full_name);
    const s = await api<BorrowingStatus>(`/users/${m.id}/borrowing-status`);
    setStatus(s);
  }

  // --- Return ---
  const [barcodeOrLoan, setBarcodeOrLoan] = useState("");
  const returnByCopy = useMutation((copyBarcode: string) =>
    api<ReturnResult>("/returns", {
      method: "POST",
      // We look up the copy id via a books search fallback isn't needed:
      // the API accepts loan_id or copy_id; here we treat the input as copy_id.
      body: { copy_id: copyBarcode },
    }),
  );

  return (
    <div className="stack">
      <h1>Circulation desk</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className={tab === "issue" ? "" : "secondary"}
          onClick={() => setTab("issue")}
        >
          Issue a book
        </button>
        <button
          className={tab === "return" ? "" : "secondary"}
          onClick={() => setTab("return")}
        >
          Return a book
        </button>
      </div>

      {tab === "issue" && (
        <div className="card stack">
          <div className="field">
            <label>1 · Find member (name, email or roll no.)</label>
            <div className="row">
              <input
                value={memberQ}
                onChange={(e) => setMemberQ(e.target.value)}
                placeholder="Asha Nair"
              />
              <button
                style={{ flex: "0 0 auto" }}
                onClick={async () => {
                  const r = await findMembers.run(memberQ);
                  if (r) setMembers(r);
                }}
              >
                Search
              </button>
            </div>
            {members.length > 0 && (
              <table style={{ marginTop: 8 }}>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.full_name}</td>
                      <td className="muted">{m.role}</td>
                      <td className="muted">{m.identifier ?? m.email}</td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => pickMember(m)}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {member && status && (
            <div className="error-box" style={{ color: "var(--text)" }}>
              <strong>{member.full_name}</strong> — {status.active_loans}/
              {status.borrow_limit} on loan, ₹
              {status.outstanding_fines.toFixed(2)} in fines.{" "}
              {status.can_borrow ? (
                <span className="badge ok">Eligible to borrow</span>
              ) : (
                <span className="badge danger">Blocked</span>
              )}
            </div>
          )}

          {member && (
            <div className="field">
              <label>2 · Find book</label>
              <div className="row">
                <input
                  value={bookQ}
                  onChange={(e) => setBookQ(e.target.value)}
                  placeholder="Clean Code"
                />
                <button
                  style={{ flex: "0 0 auto" }}
                  onClick={async () => {
                    const r = await findBooks.run(bookQ);
                    if (r) setBooks(r);
                  }}
                >
                  Search
                </button>
              </div>
              {books && (
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    {books.items.map((b) => (
                      <tr key={b.id}>
                        <td>{b.title}</td>
                        <td className="muted">{b.available_copies} avail.</td>
                        <td>
                          <button
                            disabled={issue.loading || !status?.can_borrow}
                            onClick={async () => {
                              const r = await issue.run(member.id, b.id);
                              if (r) {
                                setToast({
                                  m: `Issued “${b.title}” — due ${fmtDate(r.due_at)}`,
                                  t: "ok",
                                });
                                void pickMember(member);
                              } else {
                                setToast({
                                  m: issue.error?.message ?? "Could not issue",
                                  t: "err",
                                });
                              }
                            }}
                          >
                            Issue
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {findMembers.error && <ErrorBox error={findMembers.error} />}
        </div>
      )}

      {tab === "return" && (
        <div className="card stack">
          <div className="field">
            <label>Scan or type the copy barcode / copy ID</label>
            <div className="row">
              <input
                value={barcodeOrLoan}
                onChange={(e) => setBarcodeOrLoan(e.target.value)}
                placeholder="Copy ID"
              />
              <button
                style={{ flex: "0 0 auto" }}
                onClick={async () => {
                  const r = await returnByCopy.run(barcodeOrLoan.trim());
                  if (r) {
                    setToast({
                      m: r.fine
                        ? `${r.message} (fine ₹${r.fine.amount})`
                        : r.message,
                      t: r.fine ? "err" : "ok",
                    });
                    setBarcodeOrLoan("");
                  } else {
                    setToast({
                      m: returnByCopy.error?.message ?? "Return failed",
                      t: "err",
                    });
                  }
                }}
              >
                Return
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              Tip: open a book’s detail page to see copy IDs. Barcode-scanner
              lookup is a later enhancement.
            </p>
          </div>
          {returnByCopy.error && <ErrorBox error={returnByCopy.error} />}
        </div>
      )}

      {toast && <Toast message={toast.m} tone={toast.t} />}
    </div>
  );
}
