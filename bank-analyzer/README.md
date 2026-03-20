# Bank Analyzer

A desktop application for analyzing bank statements, built with Electron, React, TypeScript, and a Python FastAPI backend.

## Development

### Prerequisites
- Node.js 18+
- Python 3.10+

### Setup

1. Install Node dependencies:
   ```bash
   cd bank-analyzer
   npm install
   ```

2. Install Python dependencies:
   ```bash
   pip3 install -r python/requirements.txt
   ```

### Running in development

Start the Python backend and Electron app:
```bash
cd bank-analyzer
npm run dev
```

Or run just the Python backend:
```bash
cd bank-analyzer/python
python3 main.py
```

### Building for production

```bash
cd bank-analyzer
npm run build
npm run electron:build
```

## Architecture

- **Electron** (`electron/`): Main process, manages Python lifecycle, provides IPC bridge
- **React** (`src/`): UI built with Tailwind CSS and Recharts
- **FastAPI** (`python/`): PDF parsing, SQLite persistence, data export

## Features

- 📄 Upload bank statement PDFs
- 🏷️ Auto-categorize movements with keyword matching
- 📊 Visual dashboard with income/expense charts
- 📅 Month-by-month history
- 💾 Export to CSV, Excel, or text report
- ⚙️ Customizable categories with keywords, colors, and icons
