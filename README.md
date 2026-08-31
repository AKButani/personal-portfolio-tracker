# Investment Overview

A locally-run web app that consolidates a family's investments — held across many
platforms and logins (IBKR, Swiss cantonal banks, Finpension 3a, and Portfolio
Management Services) — into one view. It tracks **position-level holdings and
transactions**, computes **cost basis, gain/loss, and returns**, and tags every
account with an **owner** so the portfolio can be seen per-person or aggregated
across the whole family.

Reporting is in a single base currency (**CHF**), with FX conversion for
foreign-currency holdings. It runs locally with no authentication — it's built
for trusted use on your own machine, not as a hosted service.

## Features

- **Net worth over time**, as a stacked-area chart that breaks the total down by
  **person, account, or holding** — the top of the stack is always total net worth.
- **Gain/loss and returns** overall, per person, per account, and per holding —
  including cost basis, simple return, time-weighted return (TWR), and
  money-weighted return (XIRR).
- **Per-person filtering** across every view (a family of four, each owning
  multiple accounts).
- **Two account models:** *public* accounts priced automatically from free
  end-of-day data via ticker/ISIN, and *PMS* accounts (no public prices) valued
  from manually-entered monthly snapshots.
- **Multi-currency** holdings (e.g. USD on IBKR) converted to the CHF base using
  historical FX rates.
- **Instrument detail** pages: price history in native currency and CHF, with
  buy markers and average cost.
- **In-app data entry** for people, accounts, instruments, transactions, and PMS
  snapshots — after the initial seed, ongoing changes are made through the UI.

## Tech stack

- **Backend:** Python 3.12 · [FastAPI](https://fastapi.tiangolo.com/) ·
  [SQLModel](https://sqlmodel.tiangolo.com/) over SQLite ·
  [yfinance](https://github.com/ranaroussi/yfinance) for free EOD price + FX data ·
  managed with [uv](https://github.com/astral-sh/uv).
- **Frontend:** React 19 · TypeScript · Vite · [Recharts](https://recharts.org/) ·
  React Router · linted with [oxlint](https://oxc.rs/).
- **Tests:** pytest, including a golden-snapshot regression over the valuation
  read paths.

## Architecture

```
seed.yaml ──► seed.py ──► SQLite (investment.db) ◄── in-app forms (POST /api/…)
                              │
   yfinance ──► ingest.py ──► Price / FxRate tables
                              │
                       valuation.py  (pure functions: holdings, cost basis,
                              │        gain/loss, TWR, XIRR, time series)
                              ▼
                     FastAPI routers (/api/…)
                              ▼
              React SPA (Vite dev server proxies /api → :8000)
```

- **Holdings are derived, not stored.** There's no positions table — current
  units per `(account, instrument)` are computed on the fly from the transaction
  ledger, so the ledger is the single source of truth.
- **`valuation.py` is pure.** All valuation/return math lives in dependency-free
  functions over a DB session, which makes it straightforward to unit-test and to
  pin behavior with a golden snapshot.
- **Prices/FX are preloaded and binary-searched** for as-of-or-before lookups, so
  building a full net-worth time series stays cheap.
- **Cost basis is account-aware.** For public accounts it's driven by fund
  buys/sells; PMS accounts use contributions/withdrawals against manual snapshots.

### Key API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/valuation` | Point-in-time totals, per-person, per-account, holdings |
| `GET` | `/api/networth-history` | Net worth time series, `group_by=person\|account\|holding` |
| `GET` | `/api/performance-history` | TWR and money-weighted return over time |
| `GET` | `/api/instruments/{ticker}/history` | Price history + buy markers for one instrument |
| `POST` | `/api/refresh-prices` | Fetch latest EOD prices + FX |
| `GET/POST` | `/api/people`, `/api/accounts`, `/api/instruments`, … | Read/write entities |

## Getting started

**Prerequisites:** Python 3.12, [uv](https://github.com/astral-sh/uv), and Node 20+.

```bash
# 1. Install dependencies
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
npm install                     # root: the concurrently dev-runner

# 2. Seed the database
cd backend
cp seed.example.yaml seed.yaml  # your own copy — seed.yaml is git-ignored
uv run python seed.py           # load YAML into investment.db
uv run python ingest.py         # fetch EOD prices + FX from Yahoo Finance
cd ..

# 3. Run both servers
npm run dev                     # frontend http://localhost:5173, backend :8000
```

Then open http://localhost:5173.

> **Your data stays local.** `seed.yaml` and the SQLite database (`*.db`) are
> git-ignored, so your real portfolio is never committed. `seed.example.yaml` is a
> small fictional portfolio used as the starting template — edit your `seed.yaml`
> copy (or use the in-app forms) to enter real holdings.

You can also run the servers separately: `uv run uvicorn main:app --reload` from
`backend/`, and `npm run dev` from `frontend/`.

## Testing

```bash
cd backend && uv run pytest
```

## Project structure

```
backend/
  models.py         SQLModel tables (Person, Account, Instrument, Transaction, …)
  seed.py           load seed YAML into a fresh SQLite DB
  seed.example.yaml fictional starter portfolio (copy to seed.yaml)
  ingest.py         fetch EOD prices + FX into the DB
  valuation.py      pure valuation / gain-loss / returns / time-series logic
  routers/          FastAPI endpoints (entities, reporting)
  tests/            pytest suite incl. golden-snapshot regression
frontend/
  src/pages/        Dashboard, InstrumentPage, ManagePage
  src/components/    charts (Recharts), filters, breakdown tables
  src/api.ts        typed client for the backend
```

## Scope

Built as a focused personal-finance dashboard. Out of scope by design:
authentication, real-time pricing, and per-bank CSV import (data comes from the
seed file and in-app forms).
