import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/useApi";
import {
  Empty,
  PageHeader,
  SkeletonRows,
  Stat,
  Tabs,
  money,
} from "../../components/ui";

interface MostBorrowed {
  items: { book_id: string; title: string; loans: number }[];
}
interface Inventory {
  copies_by_status: Record<string, number>;
  by_category: { category: string; titles: number; copies: number }[];
}
interface Overdue {
  items: {
    loan_id: string;
    book: string;
    member: string;
    member_id: string;
    due_at: string;
    days_overdue: number;
  }[];
}
interface Circ {
  window_days: number;
  issued: number;
  returned: number;
  renewals: number;
  fines_raised: number;
  fines_collected: number;
}

type Tab = "summary" | "popular" | "inventory" | "overdue";

export default function Reports() {
  const [tab, setTab] = useState<Tab>("summary");
  const [days, setDays] = useState(30);

  const circ = useApi<Circ>(`/reports/circulation?days=${days}`);
  const popular = useApi<MostBorrowed>("/reports/most-borrowed?limit=20");
  const inv = useApi<Inventory>("/reports/inventory");
  const overdue = useApi<Overdue>("/reports/overdue");

  return (
    <>
      <PageHeader title="Reports" sub="Circulation, inventory and demand" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "summary", label: "Circulation" },
          { id: "popular", label: "Most borrowed" },
          { id: "inventory", label: "Inventory" },
          { id: "overdue", label: "Overdue", count: overdue.data?.items.length },
        ]}
      />

      {tab === "summary" && (
        <div className="stack">
          <div className="segmented">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                className={days === d ? "active" : ""}
                onClick={() => setDays(d)}
              >
                {d === 365 ? "1 year" : `${d} days`}
              </button>
            ))}
          </div>
          {circ.loading || !circ.data ? (
            <SkeletonRows rows={2} />
          ) : (
            <div className="grid cols-3">
              <Stat label="Issued" value={circ.data.issued} icon="↗" />
              <Stat label="Returned" value={circ.data.returned} icon="↘" />
              <Stat label="Renewals" value={circ.data.renewals} icon="⟳" />
              <Stat
                label="Fines raised"
                value={money(circ.data.fines_raised)}
                icon="₹"
              />
              <Stat
                label="Fines collected"
                value={money(circ.data.fines_collected)}
                icon="✓"
              />
            </div>
          )}
        </div>
      )}

      {tab === "popular" && (
        <div className="card">
          {popular.loading ? (
            <SkeletonRows />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th className="num">Loans</th>
                  </tr>
                </thead>
                <tbody>
                  {popular.data?.items.map((b, i) => (
                    <tr key={b.book_id}>
                      <td className="muted">{i + 1}</td>
                      <td>
                        <Link to={`/books/${b.book_id}`}>{b.title}</Link>
                      </td>
                      <td className="num">{b.loans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "inventory" && (
        <div className="grid cols-2">
          <div className="card">
            <div className="card-head">
              <h2>Copies by status</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {Object.entries(inv.data?.copies_by_status ?? {}).map(
                    ([k, v]) => (
                      <tr key={k}>
                        <td style={{ textTransform: "capitalize" }}>{k}</td>
                        <td className="num">{v}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>By category</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Titles</th>
                    <th className="num">Copies</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.data?.by_category ?? []).map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className="num">{c.titles}</td>
                      <td className="num">{c.copies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "overdue" && (
        <div className="card">
          {overdue.loading ? (
            <SkeletonRows />
          ) : overdue.data && overdue.data.items.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Due</th>
                    <th className="num">Days overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.data.items.map((o) => (
                    <tr key={o.loan_id}>
                      <td>{o.book}</td>
                      <td>{o.member}</td>
                      <td>{new Date(o.due_at).toLocaleDateString()}</td>
                      <td className="num neg">{o.days_overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="✓">Nothing overdue.</Empty>
          )}
        </div>
      )}
    </>
  );
}
