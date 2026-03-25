# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bank Analyzer is a local-first Electron desktop app for analyzing Colombian bank statements (PDF). All data stays on the user's machine.

**Stack**: Electron + React + TypeScript + Vite (frontend) / Python + FastAPI + SQLite (backend)

## Development Commands

All commands run from `bank-analyzer/`:

```bash
npm run dev              # Start full app (Vite dev server + Electron + Python backend)
npm run backend          # Run Python API in isolation
npm run build            # Build React UI + compile Electron TypeScript
npm run electron:build   # Package desktop app (macOS .dmg + Windows NSIS)
```

Python setup:
```bash
pip3 install -r python/requirements.txt
```

No test runner is configured in this project.

## Architecture

### Process Architecture

```
Electron Renderer (React)
    ↕ window.electronAPI IPC
Electron Main Process (Node.js)
    ↕ HTTP (127.0.0.1:dynamic-port)
Python FastAPI Backend
    ↕
SQLite (userData/bank_analyzer.db)
```

Electron spawns Python as a child process via `PythonBridge` (`electron/python-bridge.ts`). The port is allocated dynamically: Python writes it to a temp file (`bank_analyzer_port.json`), Electron reads it, then passes it to the renderer via IPC. The renderer stores it in `window.API_PORT` before mounting React.

### Key Files

| Purpose | File |
|---------|------|
| Electron main | `electron/main.ts` |
| Python process management | `electron/python-bridge.ts` |
| IPC handlers | `electron/ipc-handlers.ts` |
| React entry (port bootstrap) | `src/main.tsx` |
| All API calls + TS types | `src/services/api.ts` |
| FastAPI entry | `python/main.py` |
| PDF parsing (bank-specific) | `python/core/pdf_parser.py` |
| Auto-categorization | `python/core/categorizer.py` |
| SQLAlchemy models | `python/models/database.py` |
| Pydantic schemas | `python/models/schemas.py` |

### Python API Routes (`/api/v1/`)

- `statements` — upload PDF, list months, delete
- `movements` — list/update transactions
- `categories` — CRUD
- `summary` — monthly consolidation, trends
- `export` — CSV, Excel, text report

### Frontend Structure

React views (in `src/components/`): Dashboard, MesAMes (month-by-month), Trends, Settings. State via React hooks + Context API (no Redux/Zustand). Custom hooks in `src/hooks/` wrap `fetch()` against `window.API_PORT`.

Bilingual (ES/EN): flat translation dictionaries in `src/i18n/translations.ts`, accessed via `useLanguage()` hook from `src/contexts/LanguageContext.tsx`.

### Database

SQLite — auto-created at startup in Electron's `userData` directory. Override with `DB_PATH` env var. No migration tool; schema changes require manual SQL or a fresh DB.

Key tables: `months`, `movements`, `categories`, `user_category_rules`

`user_category_rules` stores manual category assignments to auto-apply on future PDF uploads.

### PDF Parsing

Bank detection by keyword scan, then dispatched to bank-specific parser. Supported banks: Davivienda, Falabella, Bancolombia, BBVA, Nequi. Handles Colombian number formatting and doubled-character PDF artifacts.

### Categorization Priority

1. User rules (`user_category_rules` table)
2. Keyword matching against normalized (diacritic-stripped) transaction descriptions

## Distribution

`electron-builder.yml` bundles a pre-built Python binary from `python-dist/`. App ID: `com.bankanalyzer.app`.
