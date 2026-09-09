import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import { AiBadge, Button, PageHeader } from "../components/ui";
import type { ChatResponse, ChatSource } from "../api/types";

interface Turn {
  role: "user" | "bot";
  text: string;
  sources?: ChatSource[];
  aiUsed?: boolean;
}

export default function Assistant() {
  const prompts = useApi<{ prompts: string[] }>("/ai/chat/prompts");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "bot",
      text: "Hi! I can help with the catalogue, your loans and fines, and library policies. I only use the library's own information.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text }]);
    setBusy(true);
    try {
      const r = await api<ChatResponse>("/ai/chat", {
        method: "POST",
        body: { question: text, session_id: sessionRef.current },
      });
      sessionRef.current = r.session_id;
      setTurns((t) => [
        ...t,
        { role: "bot", text: r.answer, sources: r.sources, aiUsed: r.ai_used },
      ]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        {
          role: "bot",
          text:
            err instanceof Error
              ? `Sorry — ${err.message}`
              : "The assistant is unavailable right now.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={
          <>
            AI Library Assistant <AiBadge />
          </>
        }
        sub="Answers are grounded in library data. Availability, due dates and fines are always confirmed against the database."
      />

      <div className="card card-pad chat ai-glow">
        <div className="chat-log" ref={logRef}>
          {turns.map((t, i) => (
            <div key={i} className={`msg ${t.role}`}>
              {t.text}
              {t.role === "bot" && t.sources && t.sources.length > 0 && (
                <div className="src">
                  {t.aiUsed === false && (
                    <span className="badge warn">AI offline — direct data</span>
                  )}
                  {t.sources.map((s, j) => (
                    <span key={j} className="badge">
                      {s.kind}: {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="msg bot muted">…thinking</div>}
        </div>

        <div>
          {turns.length <= 1 && prompts.data && (
            <div className="chip-row" style={{ marginBottom: 10 }}>
              {prompts.data.prompts.map((p) => (
                <button key={p} className="chip" onClick={() => send(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" loading={busy}>
              Send
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
