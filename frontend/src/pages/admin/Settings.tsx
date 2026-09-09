import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useApi, useMutation } from "../../lib/useApi";
import { useToast } from "../../theme";
import {
  Button,
  ErrorBox,
  Field,
  PageHeader,
  SkeletonRows,
} from "../../components/ui";

interface SettingsOut {
  values: Record<string, unknown>;
}

const GROUPS: { title: string; keys: [string, string, "text" | "number" | "bool"][] }[] = [
  {
    title: "Loans & renewals",
    keys: [
      ["max_renewals", "Max renewals per loan", "number"],
      ["renewal_extends_days", "Days added per renewal", "number"],
      ["grace_period_days", "Grace period (days)", "number"],
    ],
  },
  {
    title: "Fines",
    keys: [
      ["currency", "Currency code", "text"],
      ["overdue_fine_per_day", "Overdue fine per day", "number"],
      ["lost_book_flat_fine", "Lost-book flat fine", "number"],
      ["damage_fine", "Damage fine", "number"],
    ],
  },
  {
    title: "Reservations",
    keys: [["reservation_hold_hours", "Hold window (hours)", "number"]],
  },
  {
    title: "Library information",
    keys: [
      ["library_hours", "Opening hours", "text"],
      ["contact_email", "Contact email", "text"],
    ],
  },
  {
    title: "AI",
    keys: [
      ["ai_semantic_search_enabled", "Semantic search enabled", "bool"],
      ["ai_chatbot_enabled", "AI assistant enabled", "bool"],
    ],
  },
];

export default function Settings() {
  const { data, loading, error, reload } = useApi<SettingsOut>("/admin/settings");
  const { push } = useToast();
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (data) setDraft(data.values);
  }, [data]);

  const save = useMutation((key: string, value: unknown) =>
    api("/admin/settings", { method: "PUT", body: { key, value } }),
  );

  if (loading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        title="Library Settings"
        sub="Policy values used across the system. Changes take effect immediately."
      />
      <div className="stack">
        {GROUPS.map((g) => (
          <div key={g.title} className="card">
            <div className="card-head">
              <h2>{g.title}</h2>
            </div>
            <div className="card-body stack-sm">
              {g.keys.map(([key, label, kind]) => (
                <div key={key} className="spread" style={{ gap: 16 }}>
                  <div className="grow">
                    <Field label={label}>
                      {kind === "bool" ? (
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={!!draft[key]}
                            onChange={(e) =>
                              setDraft({ ...draft, [key]: e.target.checked })
                            }
                          />
                          {draft[key] ? "Enabled" : "Disabled"}
                        </label>
                      ) : (
                        <input
                          type={kind === "number" ? "number" : "text"}
                          value={String(draft[key] ?? "")}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [key]:
                                kind === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            })
                          }
                        />
                      )}
                    </Field>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    style={{ marginTop: 18 }}
                    loading={save.loading}
                    onClick={async () => {
                      const r = await save.run(key, draft[key]);
                      if (r !== undefined) {
                        push(`${label} saved`, "ok");
                        reload();
                      } else push("Failed", "err");
                    }}
                  >
                    Save
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
