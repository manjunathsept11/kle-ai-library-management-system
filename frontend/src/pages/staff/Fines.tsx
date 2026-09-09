import { useState } from "react";
import { api } from "../../api/client";
import { useMutation } from "../../lib/useApi";
import { usePagedQuery } from "../../lib/usePagedQuery";
import { useToast } from "../../theme";
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pager,
  SkeletonRows,
  StatusBadge,
  Tabs,
  fmtDate,
  money,
} from "../../components/ui";
import type { Fine } from "../../api/types";

type Tab = "unpaid" | "paid" | "waived" | "all";

export default function Fines() {
  const [tab, setTab] = useState<Tab>("unpaid");
  const { push } = useToast();
  const filters = tab === "all" ? {} : { status: tab };
  const { data, loading, error, page, pages, setPage, reload } =
    usePagedQuery<Fine>("/fines", filters, 25);

  const [pay, setPay] = useState<Fine | null>(null);
  const [waive, setWaive] = useState<Fine | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");

  const doPay = useMutation((id: string) =>
    api(`/fines/${id}/payment`, {
      method: "POST",
      body: { amount: Number(amount), method },
    }),
  );
  const doWaive = useMutation((id: string) =>
    api(`/fines/${id}/waive`, { method: "POST", body: { reason } }),
  );

  return (
    <>
      <PageHeader title="Fines" sub="Record payments and waive charges" />
      <Tabs
        active={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        tabs={[
          { id: "unpaid", label: "Outstanding" },
          { id: "paid", label: "Paid" },
          { id: "waived", label: "Waived" },
          { id: "all", label: "All" },
        ]}
      />
      <div className="card">
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorBox error={error} />
        ) : data && data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Raised</th>
                    <th className="num">Amount</th>
                    <th className="num">Paid</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((f) => (
                    <tr key={f.id}>
                      <td>{f.member_name ?? "—"}</td>
                      <td style={{ textTransform: "capitalize" }}>{f.type}</td>
                      <td className="muted small">{f.reason ?? "—"}</td>
                      <td>{fmtDate(f.created_at)}</td>
                      <td className="num">{money(f.amount)}</td>
                      <td className="num">{money(f.paid_amount)}</td>
                      <td>
                        <StatusBadge status={f.status} />
                      </td>
                      <td>
                        {(f.status === "unpaid" || f.status === "partial") && (
                          <div className="row-tight">
                            <Button
                              size="sm"
                              onClick={() => {
                                setPay(f);
                                setAmount(
                                  String(
                                    Math.round(
                                      (f.amount - f.paid_amount) * 100,
                                    ) / 100,
                                  ),
                                );
                              }}
                            >
                              Pay
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setWaive(f);
                                setReason("");
                              }}
                            >
                              Waive
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={data.total} onPage={setPage} />
          </>
        ) : (
          <Empty icon="₹">No fines in this view.</Empty>
        )}
      </div>

      {pay && (
        <Modal
          title={`Record payment · ${pay.member_name}`}
          onClose={() => setPay(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPay(null)}>
                Cancel
              </Button>
              <Button
                loading={doPay.loading}
                onClick={async () => {
                  const r = await doPay.run(pay.id);
                  if (r !== undefined) {
                    push("Payment recorded", "ok");
                    setPay(null);
                    reload();
                  } else push(doPay.error?.message ?? "Failed", "err");
                }}
              >
                Record
              </Button>
            </>
          }
        >
          <p className="muted small">
            Outstanding: {money(pay.amount - pay.paid_amount)}
          </p>
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </Field>
        </Modal>
      )}

      {waive && (
        <Modal
          title={`Waive fine · ${waive.member_name}`}
          onClose={() => setWaive(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setWaive(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={doWaive.loading}
                onClick={async () => {
                  const r = await doWaive.run(waive.id);
                  if (r !== undefined) {
                    push("Fine waived", "ok");
                    setWaive(null);
                    reload();
                  } else push(doWaive.error?.message ?? "Failed", "err");
                }}
              >
                Waive {money(waive.amount - waive.paid_amount)}
              </Button>
            </>
          }
        >
          <Field label="Reason (required, logged in the audit trail)">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Book was returned on time; system error"
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
