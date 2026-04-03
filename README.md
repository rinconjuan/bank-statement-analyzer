# Bank Analyzer

A desktop application for analyzing personal bank statements from Colombian banks.  
Built with **Electron + React + TypeScript** on the frontend and a **Python FastAPI** backend.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Screenshots](#screenshots)
4. [Architecture](#architecture)
5. [Tech Stack](#tech-stack)
6. [Project Structure](#project-structure)
7. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Development Setup](#development-setup)
   - [Running in Development](#running-in-development)
   - [Production Build](#production-build)
8. [Supported Banks](#supported-banks)
9. [How It Works](#how-it-works)
   - [PDF Parsing](#pdf-parsing)
   - [Data Model](#data-model)
   - [Monthly Summary Engine](#monthly-summary-engine)
   - [Categorization Engine](#categorization-engine)
   - [Trends Engine](#trends-engine)
10. [API Reference](#api-reference)
11. [Frontend Views](#frontend-views)
12. [Internationalization (i18n)](#internationalization-i18n)
13. [Data Persistence](#data-persistence)
14. [Export Formats](#export-formats)
15. [Technical Limitations](#technical-limitations)
16. [Contributing](#contributing)
17. [Known Issues](#known-issues)

---

## Overview

Bank Analyzer is a **local-first** desktop application — all data lives in a SQLite database on your machine, and the Python backend runs as a child process launched by Electron.  No internet connection is required; no data ever leaves your computer.

### Latest Updates (April 2026)

- Monthly summary now includes **CC↔Savings cross-check** fields and previous-month comparators.
- **Mes a Mes** includes visual semaphores and payment cross-validation indicators.
- Movements endpoint supports **pagination** (`skip` / `limit`) for large datasets.
- `python-bridge` includes safer orphan PID cleanup validation.
- Category deletion supports **movement reassignment** to another category.
- Falabella metadata extraction improved (`fecha_corte`, `fecha_limite_pago`) and validated with real PDFs.
- Theme color consistency improved via `useThemeColors` for components requiring real color values.

You upload bank statement PDFs from supported Colombian banks, and the app automatically:

- Parses every transaction from the PDF
- Detects the bank and statement type (savings account vs. credit card)
- Categorizes movements using keyword rules
- Builds a consolidated monthly summary that crosses savings + credit card data
- Shows spending trends, recurring charges, and savings evolution over time

---

## Features

| Feature | Description |
|---|---|
| 📄 PDF Upload | Drag-and-drop or file-picker upload for bank statement PDFs |
| 🏦 Auto Bank Detection | Detects Davivienda, Bancolombia, Falabella/CMR, BBVA, Nequi from PDF content |
| 🏷️ Smart Categorization | Keyword-based auto-categorization; manual overrides are remembered |
| 📊 Dashboard | Income/expense cards, category pie chart, monthly bar chart |
| 📅 Mes a Mes | Month-by-month balance consolidating savings + credit card statements |
| 📈 Tendencias | Spending trends per category, savings evolution, recurring charge detection |
| 💡 Help Modals | Contextual ❓ help explaining every displayed value and formula |
| 🌐 Bilingual UI | Full Spanish / English support with a single-click toggle |
| 💾 Export | CSV, Excel (.xlsx), and human-readable text report per statement |
| ⚙️ Category Editor | Create, edit, and delete expense categories with custom colors, icons, and keywords |
| 🔁 Safe Category Deletion | Delete a category and optionally reassign existing movements in one operation |
| 🗑️ Statement Deletion | Delete any uploaded month along with all its movements |
| 🚀 Auto-Update Ready | Electron updater integration with in-app install button when update is downloaded |
| 🔒 Offline & Private | Zero telemetry — all data is stored locally in SQLite |

---

## Screenshots

> _Add screenshots here once available._

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                       │
│  ┌──────────────────────┐   ┌────────────────────────┐  │
│  │   Vite/React (UI)    │   │  Electron Main Process │  │
│  │  src/                │◄──│  electron/             │  │
│  │  - App.tsx           │   │  - Spawns Python child │  │
│  │  - components/       │   │  - IPC bridge for port │  │
│  │  - hooks/useTheme... │   │  - Auto updater events │  │
│  │  - hooks/            │   │  - Window management   │  │
│  │  - services/api.ts   │   └────────────────────────┘  │
│  └──────────┬───────────┘                               │
│             │ HTTP (localhost:dynamic port)              │
│  ┌──────────▼───────────────────────────────────────┐   │
│  │           Python FastAPI Backend                  │   │
│  │  python/                                          │   │
│  │  ├── main.py          (entry point, port binding) │   │
│  │  ├── api/routes/      (REST endpoints)            │   │
│  │  ├── core/            (PDF parser, categorizer,   │   │
│  │  │                     exporter, constants)        │   │
│  │  └── models/          (SQLAlchemy ORM + schemas)  │   │
│  └──────────────────────────────────────────────────┘   │
│             │                                            │
│  ┌──────────▼──────────┐                                │
│  │   SQLite Database   │  bank_analyzer.db (local file) │
│  └─────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
```

The Electron main process spawns the Python backend as a child process on an available local port, then passes that port to the renderer via the `window.electronAPI.getApiPort()` IPC call.  The React app bootstraps (see `src/main.tsx`) by fetching the port before mounting, ensuring every API call reaches the correct backend instance.

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Electron | 30.x | Desktop shell, file system access, child-process management |
| React | 18.x | Component-based UI |
| TypeScript | 5.4+ | Type safety across the entire frontend |
| Vite | 5.x | Development server and production bundler |
| Tailwind CSS | 3.x | Utility-first styling |
| Recharts | 2.x | Bar charts, pie charts, area charts |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Runtime |
| FastAPI | 0.111 | REST API framework |
| Uvicorn | 0.29 | ASGI server |
| pdfplumber | 0.11 | PDF text extraction |
| SQLAlchemy | 2.0 | ORM + SQLite persistence |
| Pydantic | 2.7 | Request/response validation and serialization |
| pandas | 2.2 | Data manipulation for export |
| openpyxl | 3.1 | Excel (.xlsx) export |

---

## Project Structure

```
bank-analyzer/
├── electron/                # Electron main process
│   ├── main.ts              # Window creation, Python process spawning
│   ├── updater.ts           # electron-updater integration and IPC bridge
│   └── tsconfig.json
├── src/                     # React/TypeScript UI
│   ├── App.tsx              # Root component, view routing
│   ├── main.tsx             # App bootstrapping, LanguageProvider mount
│   ├── contexts/
│   │   └── LanguageContext.tsx   # ES/EN language context + useLanguage() hook
│   ├── i18n/
│   │   └── translations.ts  # Flat string dictionaries for es and en
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── SummaryCards.tsx      # Income/expense/balance cards
│   │   │   ├── CategoryChart.tsx     # Pie chart by category
│   │   │   ├── MonthlyChart.tsx      # Bar chart across months
│   │   │   ├── CreditCardSummary.tsx # Credit card overview
│   │   │   └── TrendsView.tsx        # Trends: spending, savings, recurring
│   │   ├── help/
│   │   │   └── HelpModal.tsx         # ❓ Contextual help modal (3 tabs, bilingual)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Navigation + month list
│   │   │   └── TopBar.tsx            # Month header + export + language toggle
│   │   ├── movements/
│   │   │   ├── MovementsTable.tsx    # Full movements table with filters
│   │   │   └── MovementRow.tsx       # Single movement row + category editor
│   │   ├── settings/
│   │   │   └── CategoryEditor.tsx    # CRUD for expense categories
│   │   ├── upload/
│   │   │   └── UploadZone.tsx        # Drag-and-drop PDF upload
│   │   └── views/
│   │       └── MesAMes.tsx           # Month-by-month consolidated view
│   ├── hooks/
│   │   ├── useMonths.ts     # Fetches and caches statement months
│   │   ├── useMovements.ts  # Fetches movements with filter support
│   │   ├── useCategories.ts # Fetches categories
│   │   └── useThemeColors.ts # Theme color values for chart/SVG compatibility
│   └── services/
│       └── api.ts           # All API call functions + TypeScript types
├── python/
│   ├── main.py              # FastAPI app entry point
│   ├── validate_section4.py # Real-PDF validation utility (Section 4 checklist)
│   ├── requirements.txt
│   ├── api/
│   │   ├── deps.py          # DB session dependency
│   │   └── routes/
│   │       ├── statements.py    # Upload, list, delete statements
│   │       ├── movements.py     # List, update movements
│   │       ├── categories.py    # CRUD for categories
│   │       ├── summary.py       # Monthly summary + trends calculation
│   │       └── export.py        # CSV / Excel / report export
│   ├── core/
│   │   ├── pdf_parser.py    # PDF text extraction and transaction parsing
│   │   ├── categorizer.py   # Keyword-based movement categorization
│   │   ├── exporter.py      # Export formatters
│   │   └── constants.py     # Shared keyword lists and thresholds
│   └── models/
│       ├── database.py      # SQLAlchemy models + DB engine setup
│       └── schemas.py       # Pydantic response schemas
├── electron-builder.yml     # Desktop distribution config (macOS, Windows)
├── package.json
├── tailwind.config.cjs
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

| Requirement | Minimum Version |
|---|---|
| Node.js | 18.x |
| npm | 9.x (bundled with Node 18) |
| Python | 3.10 |
| pip | any recent version |

> **macOS / Linux**: Python 3.10+ is typically installed via `brew install python` or the system package manager.  
> **Windows**: Download the official installer from [python.org](https://python.org). Make sure to tick "Add Python to PATH".

### Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/rinconjuan/bank-statement-analyzer.git
cd bank-statement-analyzer/bank-analyzer

# 2. Install Node dependencies
npm install

# 3. Install Python dependencies
pip3 install -r python/requirements.txt
```

### Running in Development

Start both the Vite dev server and the Electron shell (the Python backend is spawned automatically):

```bash
npm run dev
```

To run only the Python API (useful when developing backend routes independently):

```bash
cd python
python3 main.py
# Listens on http://localhost:8000 by default
```

### Production Build

```bash
# 1. Build the React UI and compile Electron TypeScript
npm run build

# 2. Package the desktop app (produces installers in dist-electron/)
npm run electron:build
```

Supported targets (configured in `electron-builder.yml`):

| Platform | Output format |
|---|---|
| macOS (Intel) | `.dmg` (x64) |
| macOS (Apple Silicon) | `.dmg` (arm64) |
| Windows | `.exe` installer (NSIS) + portable `.exe` |

The Python backend is bundled as a frozen binary under `python-dist/` and embedded in the package via the `extraResources` field in `electron-builder.yml`.

---

## Supported Banks

The PDF parser (`python/core/pdf_parser.py`) detects the bank from the PDF text and applies the corresponding parsing strategy:

| Bank | Statement Type | Detection Keyword |
|---|---|---|
| Davivienda | Savings account | `davivienda` |
| Banco Falabella / CMR | Credit card | `falabella` / `tarjeta cmr` |
| Bancolombia | Savings account | `bancolombia` |
| BBVA | Savings account | `bbva` |
| Nequi | Savings account | `nequi` |

> Parsers for Bancolombia, BBVA, and Nequi are present but may require further testing against real PDFs — see [Technical Limitations](#technical-limitations).

All bank name labels in the UI are read dynamically from the database `bank_name` field; no bank name is hardcoded in the frontend.

---

## How It Works

### PDF Parsing

When a PDF is uploaded, `core/pdf_parser.py`:

1. Opens the file with `pdfplumber` and extracts the raw text.
2. Calls `detect_bank()` to identify the institution.
3. Dispatches to the bank-specific parser function:
   - **Davivienda** savings: reads the balance header (saldo anterior, nuevo saldo, saldo bolsillo) and parses each transaction row.
   - **Falabella** credit card: parses the CMR statement table, handles deferred payment cuotas, detects the next-payment amount and due date.
4. Filters out internal "Bolsillo" pocket movements (defined in `constants.INTERNAL_MOVEMENT_KEYWORDS`) to prevent double-counting in summaries.
5. Returns structured `Month` + `Movement` records that are persisted to SQLite.

### Data Model

```
Month (one per uploaded PDF)
  ├── id, year, month
  ├── bank_name, statement_type ('cuenta_ahorro' | 'tarjeta_credito')
  ├── file_name, uploaded_at
  ├── min_payment, total_payment        (credit card only)
  ├── fecha_corte, fecha_limite_pago    (credit card only)
  ├── cupo_total, cupo_disponible       (credit card only)
  ├── saldo_anterior, nuevo_saldo       (savings account only)
  └── saldo_bolsillo                    (Davivienda only)

Movement (many per Month)
  ├── id, month_id (FK → Month)
  ├── date, description, amount, type ('Ingreso' | 'Egreso')
  ├── category_id (FK → Category, nullable)
  ├── applies (boolean — user can mark movements as non-applicable)
  ├── cuota_mes, total_cuotas           (credit card installments)
  └── statement_type

Category
  ├── id, name (unique)
  ├── keywords (JSON array of strings)
  ├── color (hex string)
  └── icon (emoji)

UserCategoryRule
  └── Stores manual description→category mappings to improve future auto-categorization
```

### Monthly Summary Engine

`python/api/routes/summary.py → get_monthly_summary(year, month)` produces a `MonthlySummary` by:

1. Loading all `Month` rows for the given calendar month.
2. Identifying the **savings month** (`cuenta_ahorro`) and up to one **credit month** (`tarjeta_credito`).
3. Calculating income breakdown (salary detection, other income) from savings movements.
4. Building an `expense_breakdown` list grouping outflows by category (Pago tarjeta, Mercado, Servicios, etc.).
5. Computing `balance`, `difference`, `ahorro_real` (real savings after confirmed credit-card payment).
6. Determining the **month status**:

   | Scenario | Status |
   |---|---|
   | No savings statement uploaded | `PARCIAL` |
   | Savings only, no credit card ever uploaded | `CERRADO` |
   | Savings only, credit cards exist in other months | `PARCIAL` |
   | Both statements, next month's savings loaded | `CERRADO` |
   | Both statements, no next month yet | `ACTIVO` |

7. Computing CC↔Savings cross-check values (`cc_payment_from_savings`, `cc_payment_cross_confirmed`, `cc_payment_cross_diff`).
8. Loading previous-month comparators (`prev_total_expenses`, `prev_nuevo_saldo`) for traffic-light indicators in Mes a Mes.
9. Populating `patrimonio_davivienda`, `patrimonio_neto`, and `savings_bank_name` / `credit_bank_name` for dynamic labels.

### Categorization Engine

`python/core/categorizer.py` assigns a category to every movement on upload:

1. Checks `UserCategoryRule` for any manual override matching the description fragment.
2. Scans all `Category.keywords` arrays; assigns the first matching category.
3. If no match found, leaves `category_id = null` (displayed as "Sin categoría").

Manual category changes made in the UI are stored as `UserCategoryRule` entries so the same pattern is recognized in future uploads.

### Trends Engine

`python/api/routes/summary.py → get_trends()` analyzes all uploaded statements:

- **Monthly totals**: total expenses per statement, used to compute the overall spending trend.
- **Category trends**: for each category, tracks total per statement, calculates percentage change first→last, and classifies as `up` / `down` / `stable` / `new`.
- **Savings trend**: balance evolution across all savings account statements.
- **Recurring charges**: groups movements by normalized description, flags those appearing in ≥ 2 statements.

---

## API Reference

The FastAPI backend exposes the following REST endpoints (base URL: `http://127.0.0.1:{port}/api/v1`):

### Statements
| Method | Path | Description |
|---|---|---|
| `GET` | `/statements/months` | List all uploaded statement months |
| `POST` | `/statements/upload` | Upload a PDF (`multipart/form-data`) |
| `GET` | `/statements/months/{month_id}/credit-summary` | Detailed credit-card summary for one uploaded statement |
| `DELETE` | `/statements/months/{month_id}` | Delete a statement and all its movements |

### Movements
| Method | Path | Description |
|---|---|---|
| `GET` | `/movements` | List movements (filters: `month_id`, `calendar_month`, `category_id`, `type`, `search`, `skip`, `limit`) |
| `PUT` | `/movements/{movement_id}` | Update movement category and note |
| `GET` | `/movements/summary` | Aggregated totals by category |
| `GET` | `/movements/calendar-months` | List distinct `YYYY-MM` calendar months |
| `GET` | `/movements/trends` | Trends report used by Tendencias view |

### Summary
| Method | Path | Description |
|---|---|---|
| `GET` | `/summary/monthly?year=YYYY&month=MM` | Monthly consolidated summary |
| `GET` | `/summary/available-months` | Calendar months available for monthly-summary selector |

### Categories
| Method | Path | Description |
|---|---|---|
| `GET` | `/categories/` | List all categories |
| `POST` | `/categories/` | Create a category |
| `PUT` | `/categories/{id}` | Update a category |
| `DELETE` | `/categories/{id}` | Delete category (optionally with `replacement_category_id` body to reassign movements) |

### Export
| Method | Path | Description |
|---|---|---|
| `GET` | `/export/csv/{month_id}` | Download movements as CSV |
| `GET` | `/export/excel/{month_id}` | Download movements as Excel |
| `GET` | `/export/report/{month_id}` | Download human-readable text report |

---

## Frontend Views

### Dashboard
Shows a quick summary of the month selected in the sidebar:
- **Summary cards**: Income / Expenses / Balance for savings accounts; Payments / Total Charges / Outstanding Balance for credit cards.
- **Category pie chart**: Breakdown of expenses by category.
- **Monthly bar chart**: Expense comparison across all loaded statements.

### Mes a Mes (Month by Month)
Consolidated view of all statements for a given calendar month:
- **Balance card**: QUÉ ENTRÓ (income), QUÉ SALIÓ (expenses by category), RESULTADO (month difference, savings balances, next credit card payment), PATRIMONIO (net worth after credit card debt).
- **Semaphores**: visual indicators for overspending, month-over-month spending increase, savings balance drop, and credit payment pressure.
- **CC↔Savings cross-check panel**: compares payment debited from savings vs payment registered in credit statement and flags differences.
- **Month status badge**: ✅ Cerrado · 🔄 Activo · ⏳ Parcial (see logic above).
- **Statement sections**: Full movement table per uploaded PDF with column filters.

### Tendencias (Trends)
Requires ≥ 2 uploaded statements:
- Quick stat cards.
- Savings balance evolution chart as primary signal.
- Expenses-per-statement bar chart when there is enough historical data.
- Top 3 fastest-growing expense categories.
- Category evolution list with sparklines and ↑/↓/→/★ indicators.
- Recurring charges accordion with per-occurrence history.

### Categorías (Settings)
Full CRUD editor for expense categories: name, emoji icon, hex color, keyword list.

---

## Internationalization (i18n)

The app ships with full **Spanish** (default) and **English** support.

### Architecture

| File | Purpose |
|---|---|
| `src/i18n/translations.ts` | Flat dictionaries `es` and `en`, keyed by dot-notation strings |
| `src/contexts/LanguageContext.tsx` | React context exposing `lang`, `setLang`, and `t(key, params?)` |
| `src/main.tsx` | `<App>` is wrapped in `<LanguageProvider>` |

### Switching language

Click the **🌐 ES / EN** toggle button in the top bar. The change is immediate and affects all visible text, including:
- Navigation labels
- Summary card labels and hints
- Month status badges
- Table column headers
- All three help modal tabs

### Adding a new language

1. Add a new dictionary block in `src/i18n/translations.ts`.
2. Extend the `Lang` type.
3. Update `getDict()` to return the new dictionary.
4. Add the new option to the toggle in `TopBar.tsx`.

---

## Data Persistence

- All data is stored in a single **SQLite** database file: `bank_analyzer.db`.
- Default location: the working directory where the Python process starts (inside the app's resources folder in production).
- Override the path by setting the `DB_PATH` environment variable before launch.
- **Backup**: copy `bank_analyzer.db` to back up all statements, movements, and categories.
- **Migration**: the database schema is created automatically on first run via `SQLAlchemy`'s `Base.metadata.create_all()`. There is currently no automated migration tool — schema changes require manual SQL or a fresh database.

---

## Export Formats

All exports are per-statement (one `Month` record):

| Format | Columns |
|---|---|
| **CSV** | date, description, amount, type, category, applies |
| **Excel (.xlsx)** | Same as CSV, plus auto-filtered headers and column width hints |
| **Text report** | Human-readable summary: bank, period, totals, category breakdown, movement list |

Exports are triggered from the **TopBar** buttons (📥 CSV · 📊 Excel · 📄 Reporte/Report) when a month is selected.

---

## Technical Limitations

### PDF Parsing
- The parser is **hand-tuned for specific PDF layouts** from Davivienda and Falabella. Any layout change in a future bank statement version may break parsing until the parser is updated.
- Falabella metadata extraction (minimum/total payment, cutoff and due dates) has been validated against real statements from Feb/Mar 2026.
- Parsers for **Bancolombia, BBVA, and Nequi** are present but still need broader real-world validation.
- **Password-protected PDFs** raise `PDFPasswordRequiredError` and are rejected with a user-visible error.
- PDFs that are purely image-based (no embedded text layer) cannot be parsed and will produce empty results.

### Credit Card Support
- Only **one credit card statement per calendar month** is supported in the monthly summary. If two credit card PDFs cover the same month (e.g. a billing cycle split across months), only one will be used for the consolidated balance.
- Credit card installment (`cuotas`) tracking is specific to Falabella CMR's format.

### Multi-user / Multi-account
- The app is designed for a **single user with one savings account and one credit card**. There is no account-switching or user authentication.

### Offline-only
- No cloud sync. If you use the app on multiple computers, you must manually transfer `bank_analyzer.db`.

### Schema Migrations
- There is no migration engine. Adding new columns to existing tables requires either a manual `ALTER TABLE` in SQLite or deleting and recreating the database.

### Windows Development
- The `npm run dev` script uses Windows path separators in the `tsc` call. On macOS/Linux, run `./node_modules/.bin/tsc -p electron/tsconfig.json` instead, or adjust the script in `package.json`.

---

## Contributing

### Branching strategy
- `main` — stable releases only
- `develop` — integration branch; all feature PRs target here
- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<short-description>`
- Copilot-assisted branches: `copilot/<short-description>`

### Adding a new bank parser
1. Add detection logic in `python/core/pdf_parser.py → detect_bank()`.
2. Implement a `parse_<bankname>(pdf, text)` function returning `(Month, list[Movement])`.
3. Add the new bank name to the `BANK_PATTERNS` dict and dispatch it in `parse_pdf()`.
4. Add test PDFs (anonymized) to the `tests/fixtures/` directory.

### Adding a new expense category
Categories are managed at runtime via the UI. No code changes needed.

### Code style
- **Python**: follow PEP 8; use type hints throughout.
- **TypeScript/React**: functional components with hooks; no class components.
- **Styling**: Tailwind utility classes only; avoid custom CSS files except for `src/styles/globals.css` (CSS variables for theming).

### Running the TypeScript checker
```bash
cd bank-analyzer
./node_modules/.bin/tsc --noEmit
```

---

## Known Issues

| Issue | Status |
|---|---|
| Bancolombia / BBVA / Nequi parsers need real-world validation | Open |
| No automated SQLite migration when schema changes | Open |
| Auto-update requires valid `publish` owner/repo in `electron-builder.yml` | Pending environment configuration |
| Very large PDFs (50+ pages) may be slow to parse | Open |
| Only one credit card per calendar month supported in the summary | By design (current scope) |
