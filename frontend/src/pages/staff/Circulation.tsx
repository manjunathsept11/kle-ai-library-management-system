import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useMutation } from "../../lib/useApi";
import { useToast } from "../../theme";
import {
  Button,
  Empty,
  Field,
  PageHeader,
  StatusBadge,
  fmtDate,
} from "../../components/ui";
import type {
  BorrowingStatus,
  Loan,
  Page,
  User,
} from "../../api/types";

interface ReturnResult {
  loan: Loan;
  fine: { amount: number; type: string } | null;
  message: string;
}

export default function Circulation() {
  const [tab, setTab] = useState<"issue" | "return">("issue");
  const { push } = useToast();

  // issue
  const [memberQ, setMemberQ] = useState("");
  const [members, setMembers] = useState<User[]>([]);
  const [member, setMember] = useState<User | null>(null);
  const [status, setStatus] = useState<BorrowingStatus | null>(null);
  const [memberLoans, setMemberLoans] = useState<Loan[]>([]);
  const [bookQ, setBookQ] = useState("");
  const [books, setBooks] = useState<
    { id: string; title: string; available_copies: number }[]
  >([]);

  const findMembers = useMutation((q: string) =>
    api<User[]>(`/users?q=${encodeURIComponent(q)}`),
  );
  const findBooks = useMutation((q: string) =>
    api<Page<{ id: string; title: string; available_copies: number }>>(
      `/books?q=${encodeURIComponent(q)}&available_only=true&page_size=8`,
    ),
  );
  const issue = useMutation((m: string, b: string) =>
    api<Loan>("/issues", { method: "POST", body: { member_id: m, book_id: b } }),
  );
  const returnLoan = useMutation((loanId: string) =>
    api<ReturnResult>("/returns", { method: "POST", body: { loan_id: loanId } }),
  );

  async function selectMember(m: User) {
    setMember(m);
    setMembers([]);
    setMemberQ(m.full_name);
    setStatus(await api<BorrowingStatus>(`/users/${m.id}/borrowing-status`));
    const ln = await api<Page<Loan>>(
      `/loans?member_id=${m.id}&active_only=true&page_size=50`,
    );
    setMemberLoans(ln.items);
  }

  // return by barcode
  const [barcode, setBarcode] = useState("");
  const returnByBarcode = useMutation(async (bc: string) => {
    const copies = await api<Page<{ id: string }>>(
      `/copies?q=${encodeURIComponent(bc)}&status=issued&page_size=1`,
    );
    if (!copies.items.length) throw new Error("No issued copy with that barcode");
    return api<ReturnResult>("/returns", {
      method: "POST",
      body: { copy_id: copies.items[0].id },
    });
  });

  return (
    <>
      <PageHeader title="Circulation Desk" sub="Issue and return books" />
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          className={tab === "issue" ? "active" : ""}
          onClick={() => setTab("issue")}
        >
          Issue
        </button>
        <button
          className={tab === "return" ? "active" : ""}
          onClick={() => setTab("return")}
        >
          Return
        </button>
      </div>

      {tab === "issue" && (
        <div className="stack">
          <div className="card card-pad stack-sm">
            <Field label="1 · Find member (name, email or roll no.)">
              <div className="input-group">
                <input
                  value={memberQ}
                  onChange={(e) => setMemberQ(e.target.value)}
                  placeholder="Asha Nair"
                />
                <Button
                  loading={findMembers.loading}
                  onClick={async () => {
                    const r = await findMembers.run(memberQ);
                    if (r) setMembers(r);
                  }}
                >
                  Search
                </Button>
              </div>
            </Field>
            {members.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td>{m.full_name}</td>
                        <td className="muted">{m.role}</td>
                        <td className="muted">{m.identifier ?? m.email}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => selectMember(m)}
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {member && status && (
            <>
              <div className="callout">
                <strong>{member.full_name}</strong> — {status.active_loans}/
                {status.borrow_limit} on loan · ₹
                {status.outstanding_fines.toFixed(2)} fines ·{" "}
                {status.can_borrow ? (
                  <span className="badge ok">Eligible</span>
                ) : (
                  <span className="badge danger">Blocked</span>
                )}
              </div>

              {memberLoans.length > 0 && (
                <div className="card">
                  <div className="card-head">
                    <h3>Current loans — quick return</h3>
                  </div>
                  <div className="table-wrap">
                    <table className="data">
                      <tbody>
                        {memberLoans.map((l) => (
                          <tr key={l.id}>
                            <td>{l.book.title}</td>
                            <td>
                              due {fmtDate(l.due_at)}{" "}
                              <StatusBadge status={l.status} />
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  const r = await returnLoan.run(l.id);
                                  if (r) {
                                    push(r.message, r.fine ? "err" : "ok");
                                    selectMember(member);
                                  }
                                }}
                              >
                                Return
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="card card-pad stack-sm">
                <Field label="2 · Find a book to issue">
                  <div className="input-group">
                    <input
                      value={bookQ}
                      onChange={(e) => setBookQ(e.target.value)}
                      placeholder="Clean Code"
                    />
                    <Button
                      loading={findBooks.loading}
                      onClick={async () => {
                        const r = await findBooks.run(bookQ);
                        if (r) setBooks(r.items);
                      }}
                    >
                      Search
                    </Button>
                  </div>
                </Field>
                {books.length > 0 && (
                  <div className="table-wrap">
                    <table className="data">
                      <tbody>
                        {books.map((b) => (
                          <tr key={b.id}>
                            <td>{b.title}</td>
                            <td className="muted">
                              {b.available_copies} available
                            </td>
                            <td>
                              <Button
                                size="sm"
                                disabled={!status.can_borrow}
                                loading={issue.loading}
                                onClick={async () => {
                                  const r = await issue.run(member.id, b.id);
                                  if (r) {
                                    push(
                                      `Issued “${b.title}” — due ${fmtDate(r.due_at)}`,
                                      "ok",
                                    );
                                    selectMember(member);
                                  } else
                                    push(
                                      issue.error?.message ?? "Failed",
                                      "err",
                                    );
                                }}
                              >
                                Issue
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "return" && (
        <div className="card card-pad stack-sm">
          <Field
            label="Scan or type a copy barcode"
            hint="Or use the quick-return list under a member in the Issue tab, or the Loans page."
          >
            <div className="input-group">
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="KLE20230001..."
              />
              <Button
                loading={returnByBarcode.loading}
                onClick={async () => {
                  const r = await returnByBarcode.run(barcode.trim());
                  if (r) {
                    push(r.message, r.fine ? "err" : "ok");
                    setBarcode("");
                  } else
                    push(returnByBarcode.error?.message ?? "Failed", "err");
                }}
              >
                Return
              </Button>
            </div>
          </Field>
          <p className="muted small">
            Barcodes are shown on each <Link to="/staff/inventory">copy</Link> and
            on the book detail page.
          </p>
          <Empty icon="⇄">Scan a barcode above to process a return.</Empty>
        </div>
      )}
    </>
  );
}
