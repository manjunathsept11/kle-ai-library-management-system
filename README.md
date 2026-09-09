# KLE Institute — AI-Powered Library Management System

An intelligent library management system: full traditional circulation (catalogue,
per-copy inventory, issue / return / renew, fines) **plus** genuinely integrated
AI — natural-language semantic search and a retrieval-augmented (RAG) library
assistant. The core library keeps working even with AI switched off.

> "KLE Institute" is only a display label. No real institutional branding,
> policies, member records or statistics are invented — every institutional value
> is admin-configurable and all seed data is fictional.

---

## 1. Status

**Vertical slice — working end to end, automated + manually tested.**

| Area | State |
|------|-------|
| Auth: JWT access/refresh with rotation, argon2 hashing, account lockout, RBAC | ✅ |
| Book catalogue, authors/categories/publishers, per-copy inventory | ✅ |
| Circulation: issue / return / renew, automatic overdue fines, borrow-limit + fine-block rules | ✅ |
| Search: keyword + **AI semantic** + hybrid, each result shows *why* it matched | ✅ |
| **AI assistant (RAG)**: policy retrieval + the member's own loans/fines/availability, grounded sources | ✅ |
| React UI: member & librarian dashboards, catalogue, book detail, AI search, assistant, my loans, staff issue/return, staff add-book | ✅ |
| Reservations & queue, fine payments/waivers, notifications, reports/exports, audit-log UI, admin settings UI | ⏳ planned |
| OCR, research assistant, demand forecasting, procurement ML, voice | 🔮 v2+ |

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic |
| Database | **SQLite** for local dev (zero setup). PostgreSQL + `pgvector` is the documented production target; the data layer is isolated so the swap is clean. |
| AI | Provider interfaces with a `mock` implementation (fully offline, default) and `openai` / `anthropic` implementations. Book embeddings ranked in-process with NumPy cosine similarity. |
| Frontend | React 18 + TypeScript + Vite |

---

## 3. Prerequisites

- **Python 3.12** — check with `py -3.12 --version` (Windows) or `python3.12 --version`
- **Node.js 18+** and npm — check with `node --version`
- **Git**
- No Docker, no PostgreSQL, no Redis required for local development.

Ports used: **8000** (API) and **5180** (web UI).
The Vite default 5173 is deliberately avoided — change it in
`frontend/vite.config.ts` if 5180 is also busy on your machine.

---

## 4. Running the application

Clone, then open **two terminals** — one for the API, one for the web UI.

### Terminal 1 — Backend API

```bash
cd library-ai-system/backend

# create + activate a virtualenv
py -3.12 -m venv .venv                 # Windows
# python3.12 -m venv .venv             # macOS/Linux

# install dependencies
.venv/Scripts/python.exe -m pip install -r requirements.txt      # Windows
# .venv/bin/python -m pip install -r requirements.txt            # macOS/Linux

# configuration — defaults work out of the box for local dev
cp ../.env.example ../.env

# create the database schema
.venv/Scripts/alembic.exe upgrade head

# load fictional demo data + build the AI search index
.venv/Scripts/python.exe -m scripts.seed

# start the API (auto-reloads on code changes)
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`.
Check it: open http://localhost:8000/api/v1/health → `{"status":"ok",...}`
Interactive API docs: http://localhost:8000/docs

> On macOS/Linux, replace `.venv/Scripts/<tool>.exe` with `.venv/bin/<tool>`.

### Terminal 2 — Frontend

```bash
cd library-ai-system/frontend
npm install
npm run dev
```

Then open **http://localhost:5180**.

The dev server proxies all `/api/*` calls to `http://localhost:8000`, so the
browser only ever talks to one origin (no CORS issues).

---

## 5. Demo accounts

All demo accounts use the password **`Password123`**.
The login screen also has one-click buttons for each role.

| Email | Role | What they can do |
|-------|------|------------------|
| `asha@kle.edu` | Student | search, borrow (via desk), see own loans/fines, renew, use AI |
| `vikram@kle.edu` | Student | second student for issue/return testing |
| `prof.iyer@kle.edu` | Faculty | 30-day loans, higher borrow limit |
| `librarian@kle.edu` | Librarian | manage books & copies, issue/return, staff dashboard |
| `admin@kle.edu` | Administrator | everything a librarian can do (admin console is planned) |

---

## 6. Manual test walkthrough

A full pass takes about 5 minutes.

### 6.1 Auth & roles
1. Open http://localhost:5180 → click **Student** demo button → **Sign in**.
2. You land on the member dashboard: "Books on loan", "Borrowing limit",
   "Outstanding fines", "Due soon" (Asha starts with *Clean Code* on loan).
3. Sign out (bottom of the sidebar) → sign in as **Librarian** → you now see a
   different dashboard plus **Issue / Return** and **Manage Books** in the sidebar.
4. As a student, manually visiting `/staff/books` redirects you away (RBAC).

### 6.2 Catalogue
1. As any user, open **Catalogue**.
2. Search `python` → results filter. Tick **Available only** → out-of-stock
   titles disappear. Use **Prev / Next** to page.
3. Click a book → detail page shows metadata, the **Copies** table (with
   barcodes and per-copy status), and an AI **Similar books** section.

### 6.3 AI Smart Search
1. Open **AI Smart Search**.
2. Click the example chip *"cybersecurity books about web attacks"* (or type your
   own natural-language query). Try each **Mode**: Hybrid / AI semantic / Keyword.
3. Each result card shows a **"why it matched"** reason and a relevance score;
   the header shows an **AI ranked** badge.
4. *Note:* with the default `mock` embedding provider the ranking is deterministic
   but not truly semantic — set a real provider (section 8) for meaningful results.

### 6.4 AI Assistant
1. Open **AI Assistant**.
2. Ask *"What books do I have on loan right now?"* → it reports your **actual**
   loans from the database, with a source chip (`loan: Clean Code`).
3. Ask *"Explain the borrowing and renewal policy"* → answer is grounded in the
   policy documents, shown as `policy: …` source chips.
4. Ask *"What has <another member> borrowed?"* → it will **not** reveal another
   member's data.
5. With `mock` LLM the wording is terse (it echoes the retrieved context); a real
   LLM provider (section 8) produces natural answers. Grounding is identical
   either way.

### 6.5 Circulation (as Librarian)
1. Sign in as **Librarian** → **Issue / Return**.
2. **Issue:** search a member (e.g. `Vikram`) → **Select** → their borrowing
   status appears. Search a book (e.g. `Head First Java`) → **Issue**. A toast
   confirms the due date; the member's loan count goes up.
3. Sign in as that member → **My Loans** shows the new loan → click **Renew** →
   due date extends (capped at 2 renewals).
4. **Return:** back as Librarian → **Issue / Return → Return** tab. Enter the
   **copy ID** (find it on the book's detail page, Copies table) → **Return**.
   Returned on time → no fine. (An overdue return auto-creates an overdue fine —
   covered by the automated tests.)
5. Try issuing a 5th book to a student → blocked with a clear "borrowing limit"
   message.

### 6.6 Add a book (as Librarian)
1. **Manage Books** → fill Title + Authors (comma-separated) + Initial copies →
   **Add book**.
2. You're taken to the new book's page. It's indexed for AI search automatically —
   search for it in **AI Smart Search**.

### 6.7 AI-off behaviour
1. Stop the backend. In `../.env` set `AI_ENABLED=false`. Restart the backend.
2. **AI Smart Search** still works (keyword only, with a notice).
   **AI Assistant** returns a clear "assistant is turned off" message.
   All catalogue and circulation features are unaffected.
3. Revert `AI_ENABLED=true` and restart.

---

## 7. Automated tests & checks

### Backend (25 tests)

```bash
cd library-ai-system/backend
.venv/Scripts/python.exe -m pytest            # run all tests
.venv/Scripts/python.exe -m pytest -v         # verbose
.venv/Scripts/ruff.exe check .                # lint
```

Tests use a throwaway SQLite database and forced `mock` AI providers, so they
never touch your dev data and never make network calls.

### Frontend

```bash
cd library-ai-system/frontend
npm run build        # type-check (tsc) + production build
npm run lint         # eslint
```

---

## 8. Enabling real AI (optional)

Edit `library-ai-system/.env`, then restart the backend:

```ini
AI_ENABLED=true
LLM_PROVIDER=openai            # or: anthropic
EMBEDDING_PROVIDER=openai
LLM_API_KEY=sk-...
EMBEDDING_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
```

Then rebuild the semantic index (embeddings must match the new provider):

```bash
# as a librarian, call:  POST http://localhost:8000/api/v1/search/reindex
# or simply re-seed:
.venv/Scripts/python.exe -m scripts.seed --reset
```

With `LLM_PROVIDER=mock` / `EMBEDDING_PROVIDER=mock` (the defaults) everything
runs fully offline — no API key needed.

---

## 9. Resetting / troubleshooting

| Problem | Fix |
|---------|-----|
| Want fresh demo data | `cd backend && .venv/Scripts/python.exe -m scripts.seed --reset` |
| Corrupted local DB | delete `backend/var/library.db*`, then `alembic upgrade head` + `scripts.seed` |
| Port 5180 busy | change `server.port` in `frontend/vite.config.ts` and the proxy stays the same |
| Port 8000 busy | run uvicorn with `--port 8001` and set `VITE_API_BASE_URL` / vite proxy target accordingly |
| Browser shows an old/stale page | hard refresh (Ctrl/Cmd+Shift+R); if a service worker from a previous app on that port interferes, use a fresh port |
| `alembic: command not found` | you skipped the venv — use `.venv/Scripts/alembic.exe` (Windows) or `.venv/bin/alembic` |
| 401s in the UI after idling | tokens expired; the app auto-refreshes, but you can just sign in again |
| Login rejects a `@something.local` email | use a real-looking domain (`@kle.edu`); `.local` TLDs are rejected by the email validator |

---

## 10. AI safety model

- The **database is authoritative** for availability, loans, fines and
  reservations. The assistant is instructed never to invent these and is handed
  already-verified facts from typed helper functions — the LLM cannot run queries
  or call tools itself.
- Retrieved documents are treated as **untrusted content** and cannot override
  system instructions (prompt-injection defence): system / user / retrieved-doc
  contexts are kept separate.
- The assistant only ever sees the **requesting member's own** data.
- Every AI response is **labelled** and carries its grounding sources.
- If AI is unavailable, keyword search and every library operation keep working.
- No institutional facts are hard-coded; all demo data is fictional and never
  presented as real KLE data.

---

## 11. Project layout

```
library-ai-system/
├─ backend/
│  ├─ app/
│  │  ├─ api/v1/        auth, users, books, search, circulation, chat, health
│  │  ├─ core/          config, security, errors, logging, clock
│  │  ├─ models/        users, catalogue, circulation, ai, settings, audit
│  │  ├─ schemas/       pydantic request/response models
│  │  ├─ services/      auth, catalog, circulation, search, chat, knowledge,
│  │  │                 settings, audit  +  ai/ (embeddings, llm providers)
│  │  └─ workers/       in-process background job runner
│  ├─ alembic/          migrations
│  ├─ scripts/          seed.py + seed_data.py (fictional demo data)
│  └─ tests/            pytest suite
├─ frontend/
│  └─ src/  api/ · auth/ · components/ · lib/ · pages/
├─ docs/                design docs (WIP)
├─ deployment/          Docker assets kept for future production use
└─ docker-compose.yml   not needed for local dev
```

---

## 12. Roadmap

Thin slice (done) → reservations & queue → fine payments / waivers + management
screens → notifications (in-app + email) → reports & exports → audit-log &
admin-settings UI → hardening → migrate to PostgreSQL + pgvector for production.
