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

**Working end to end — automated + manually tested. Light & dark themes.**

| Area | State |
|------|-------|
| Auth: JWT access/refresh with rotation, argon2, account lockout, RBAC (4 roles) | ✅ |
| Catalogue, authors/categories/publishers, **shelves**, per-copy inventory | ✅ |
| Circulation: issue / return / renew, automatic overdue fines, borrow-limit + fine-block rules | ✅ |
| **Reservations**: place / cancel, per-title hold queue, auto-promote on return, expiry | ✅ |
| **Fine management**: record payment, partial payment, waive (with reason), manual fines | ✅ |
| **Notifications**: in-app feed + bell, mark read, staff announcements/broadcast | ✅ |
| **Favorites**: save / unsave books | ✅ |
| Search: keyword + **AI semantic** + hybrid, each result shows *why* it matched | ✅ |
| **AI assistant (RAG)**: policy retrieval + member's own loans/fines/availability, grounded sources | ✅ |
| **Admin console**: users (create/edit/suspend/reset), departments, runtime settings, audit log | ✅ |
| **Reports**: role-aware dashboards, most-borrowed, inventory, overdue, circulation summary | ✅ |
| React UI: 25+ pages, role-based nav, light/dark theme, responsive | ✅ |
| OCR, research assistant, demand forecasting, procurement ML, voice, email delivery | 🔮 v2+ |

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

The theme toggle (☾ / ☀ in the top bar) switches light/dark and is remembered.

### 6.1 Auth & roles
1. Open http://localhost:5180 → click a demo chip → **Sign in**.
2. **Student / Faculty** see: Dashboard, Catalogue, AI Smart Search, AI Assistant,
   My Library, Favorites, Notifications.
3. **Librarian** adds a *Librarian* section (Circulation Desk, Loans & Returns,
   Reservations, Fines, Books, Inventory, Shelves, Categories).
4. **Admin** adds an *Administrator* section (Users, Departments, Reports,
   Settings, Audit Log).
5. As a student, visiting `/admin/users` or `/staff/loans` redirects you away (RBAC).

### 6.2 Student / Faculty
- **Catalogue** — search, filter by category, "Available only", paginate. Open a
  book → metadata, copies table, AI **Similar books**, **☆ Save**, and **Reserve**
  (shown only when no copy is available — try *Deep Learning*).
- **My Library** — tabs for **Current** (with **Renew**), **Reservations** (with
  queue position and **Cancel**), **Fines** (Vikram has an outstanding one),
  **History**.
- **Favorites** — the books you saved.
- **Notifications** — bell in the top bar shows unread count; the page lists all,
  click one to mark read and jump to its target.
- **Profile** — edit name/phone, change password.

### 6.3 AI Smart Search & Assistant
- **AI Smart Search**: try the example chips or your own query; switch
  Hybrid / AI semantic / Keyword; each result shows a "why it matched" reason.
- **AI Assistant**: ask *"what books do I have on loan"*, *"explain the borrowing
  policy"*, *"do I have fines"* — answers carry grounding source chips and never
  expose another member's data.
- With the default `mock` providers, semantic ranking is deterministic (not truly
  semantic) and the assistant echoes retrieved context. Set real keys (section 8)
  for production-quality output. Grounding and safety are identical either way.

### 6.4 Librarian — Circulation
- **Circulation Desk → Issue**: search a member → **Select** (borrowing status +
  a quick-return list of their loans appears) → search a book → **Issue**.
- **Circulation Desk → Return**: type/scan a copy barcode (barcodes are on the
  **Inventory** page and each book's Copies table).
- **Loans & Returns**: filter by On loan / Overdue / Returned / All and by title;
  **Renew** or **Return** any loan inline.
- **Reservations**: see the hold queue; "Ready for pickup" holds are waiting at
  the desk. Return the last copy of *Deep Learning* → the next person in the queue
  is auto-promoted and notified.
- **Fines**: **Pay** (full or partial, with method) or **Waive** (reason is
  logged to the audit trail).

### 6.5 Librarian — Catalogue management
- **Books**: add a book (modal), archive one (blocked if copies are on loan).
- **Inventory**: every copy with shelf/condition/status/price; **Edit** to change
  status, reassign a shelf, set condition/price/notes.
- **Shelves**: create/edit shelves, see fill level, view the copies on each.
- **Categories**: manage categories, publishers and authors (delete is blocked
  while books reference them).

### 6.6 Admin
- **Users**: filter by role/status, **+ Add user** (create a librarian),
  **Edit** (change role, suspend, set a borrow-limit override, staff notes),
  **Reset PW**. You can't change your own role.
- **Departments**: CRUD.
- **Reports**: circulation summary (7/30/90/365 days), most borrowed, inventory
  breakdown, overdue list.
- **Settings**: edit any policy value (loan periods, fine rates, reservation hold
  window, library hours, AI on/off) — changes apply immediately.
- **Audit Log**: every data-changing action; filter by action prefix
  (`loan.`, `fine.`, `admin.`).

### 6.7 AI-off behaviour
1. Stop the backend, set `AI_ENABLED=false` in `.env`, restart.
2. **AI Smart Search** still works (keyword only, with a notice); **AI Assistant**
   returns a clear "turned off" message; everything else is unaffected.
3. Or leave AI on and toggle **Settings → AI → AI assistant enabled** off.

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

**Done:** core circulation, reservations & queue, fines management,
notifications, favorites, semantic search, RAG assistant, full admin console,
reports, light/dark themed UI across 25+ pages.

**Next:** email delivery for notifications, CSV/PDF export on reports,
bulk book import, cover-image upload, saved-search alerts, then hardening
(load test, backup drill, rate limits) and migration to PostgreSQL + pgvector
for production.

**v2+:** OCR / digital library, AI research assistant, ML demand forecasting,
procurement suggestions, voice search.
