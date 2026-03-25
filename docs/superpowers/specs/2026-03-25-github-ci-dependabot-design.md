# GitHub CI Audit + Dependabot Design

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Add GitHub Actions CI workflow and Dependabot configuration to the Bank Statement Analyzer repo.

---

## Goal

Automatically catch security vulnerabilities and code quality issues on every PR targeting `develop`, and keep dependencies up to date daily via Dependabot.

---

## Files to Create

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI workflow — runs on PRs to `develop` |
| `.github/dependabot.yml` | Dependabot — daily updates for npm and pip |

---

## CI Workflow — `.github/workflows/ci.yml`

### Trigger

```yaml
on:
  pull_request:
    branches: [develop]
```

Runs on every PR targeting `develop` (the repo's default integration branch). Does not run on push to feature branches (reduces noise).

### Job 1: `audit-node`

**Runs on:** `ubuntu-latest`
**Working directory:** `bank-analyzer/`

Steps:
1. Checkout repo
2. Cache `~/.npm` keyed on hash of `bank-analyzer/package-lock.json`
3. `npm ci` — clean install from lockfile
4. `npm audit --audit-level=high` — fail only on high/critical CVEs; ignores low/moderate noise
5. `npx tsc --noEmit` — type-check the React/Vite frontend (`tsconfig.json`)
6. `npx tsc -p electron/tsconfig.json --noEmit` — type-check the Electron main process separately (it has its own standalone tsconfig not referenced by the root one)

No ESLint step — no ESLint config exists in the project.

### Job 2: `audit-python`

**Runs on:** `ubuntu-latest`
**Working directory:** `bank-analyzer/python/`

Steps:
1. Checkout repo
2. Setup Python 3.11
3. Cache pip packages keyed on hash of `bank-analyzer/python/requirements.txt`
4. `pip install pip-audit ruff`
5. `pip-audit -r requirements.txt` — scan for CVEs in Python dependencies
6. `ruff check .` — lint Python source (zero config required; works out of the box)

### Parallelism

Both jobs run in parallel (`needs:` not set). A failing security scan in one does not block seeing results from the other. Both must pass for the PR check to go green.

---

## Dependabot — `.github/dependabot.yml`

### npm ecosystem

- **Directory:** `/bank-analyzer` (location of `package.json`)
- **Schedule:** daily
- **Target branch:** `develop`
- **Grouping:** All non-security updates grouped into one PR per day. Security fixes always open as individual PRs immediately, bypassing grouping.

### pip ecosystem

- **Directory:** `/bank-analyzer/python` (location of `requirements.txt`)
- **Schedule:** daily
- **Target branch:** `develop`
- **Grouping:** Same strategy as npm.

---

## Behaviour Summary

| Event | Result |
|-------|--------|
| PR opened/updated targeting `develop` | Both CI jobs run in parallel |
| `npm audit` finds high/critical CVE | `audit-node` job fails, PR blocked |
| `tsc --noEmit` finds type errors | `audit-node` job fails, PR blocked |
| `pip-audit` finds CVE | `audit-python` job fails, PR blocked |
| `ruff` finds lint errors | `audit-python` job fails, PR blocked |
| Dependabot finds npm update | PR opened against `develop` (grouped daily) |
| Dependabot finds pip update | PR opened against `develop` (grouped daily) |
| Dependabot finds security vulnerability | Immediate individual PR, not grouped |

---

## Out of Scope

- Build verification (no reproducible build without macOS/Windows runners + code signing)
- Test execution (no test runner configured in the project)
- Release automation / artifact publishing
- Branch protection rules (configured in GitHub UI, not in files)
