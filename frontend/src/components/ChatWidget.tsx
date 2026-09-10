import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ChatResponse, ChatSource } from "../api/types";

interface Turn {
  role: "user" | "bot";
  text: string;
  sources?: ChatSource[];
  aiUsed?: boolean;
}

const GREETING: Turn = {
  role: "bot",
  text: "Hi 👋 Ask me about the catalogue, your loans and fines, or library policy.",
};

const QUICK = [
  "What books do I have on loan?",
  "Do I have any fines?",
  "Find beginner books on AI",
  "What are the opening hours?",
];

export default function ChatWidget() {
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Hide on the full-page assistant and on auth screens.
  const hidden = loc.pathname === "/assistant";

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, open]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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

  if (hidden) return null;

  return (
    <>
      <button
        className={`chat-fab ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open AI assistant"}
      >
        <span className="chat-fab-icon">{open ? "✕" : "✦"}</span>
        {!open && <span className="chat-fab-ping" />}
      </button>

      {open && (
        <div className="chat-pop" role="dialog" aria-label="AI assistant">
          <header className="chat-pop-head">
            <div>
              <strong>AI Assistant</strong>
              <div className="muted" style={{ fontSize: 11 }}>
                Grounded in library data
              </div>
            </div>
            <button
              className="btn ghost sm"
              onClick={() => {
                setOpen(false);
                nav("/assistant");
              }}
            >
              Full view ↗
            </button>
          </header>

          <div className="chat-pop-log" ref={logRef}>
            {turns.map((t, i) => (
              <div key={i} className={`msg ${t.role}`}>
                {t.text}
                {t.role === "bot" && t.sources && t.sources.length > 0 && (
                  <div className="src">
                    {t.aiUsed === false && (
                      <span className="badge warn">direct data</span>
                    )}
                    {t.sources.slice(0, 4).map((s, j) => (
                      <span key={j} className="badge">
                        {s.kind}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="msg bot muted">…thinking</div>}
          </div>

          {turns.length <= 1 && (
            <div className="chat-pop-quick">
              {QUICK.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className="chat-pop-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button className="btn sm" type="submit" disabled={busy}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
