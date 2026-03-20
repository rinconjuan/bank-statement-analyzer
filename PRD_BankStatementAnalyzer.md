# PRD — Bank Statement Analyzer Desktop App
**Versión:** 1.0  
**Stack:** Electron + TypeScript (frontend) · FastAPI + Python (backend) · SQLite (persistencia)  
**Plataformas objetivo:** macOS (dmg) · Windows (exe/msi)  
**Audiencia del documento:** IA desarrolladora / equipo técnico

---

## 1. Visión General

Aplicación de escritorio que permite cargar extractos bancarios en PDF, categorizarlos automáticamente, visualizar el historial mes a mes con gráficas, y exportar reportes. Pensada para uso personal y distribución informal entre amigos sin conocimientos técnicos.

### Principio rector
> "Carga tu extracto, entiende tu dinero en 30 segundos."

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON (Main Process)                  │
│  - Ciclo de vida de la app                                      │
│  - Menú nativo (Mac/Windows)                                    │
│  - Auto-updater (electron-updater)                              │
│  - Lanzamiento y control del proceso Python                     │
│  - IPC Bridge (ipcMain)                                         │
└────────────────┬────────────────────────────────────────────────┘
                 │ ipcRenderer ↔ ipcMain
┌────────────────▼────────────────────────────────────────────────┐
│                   ELECTRON (Renderer Process)                    │
│  TypeScript + React + Tailwind CSS                              │
│  Vite como bundler                                              │
│  Componentes: Dashboard, Upload, History, Settings              │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP (localhost:puerto aleatorio)
┌────────────────▼────────────────────────────────────────────────┐
│                     PYTHON BACKEND (FastAPI)                     │
│  - Parseo de PDFs (pdfplumber)                                  │
│  - Categorización de movimientos                                 │
│  - CRUD de meses e historial (SQLite vía SQLAlchemy)            │
│  - Exportación CSV / Excel                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │ SQLAlchemy ORM
┌────────────────▼────────────────────────────────────────────────┐
│                    SQLite (archivo local)                         │
│  Ubicación: app.getPath('userData')/bank_analyzer.db            │
└─────────────────────────────────────────────────────────────────┘
```

### Comunicación Electron ↔ Python
- Al iniciar, Electron lanza el ejecutable Python como proceso hijo
- Python busca un puerto libre y lo escribe en un archivo temporal
- Electron lee ese puerto y lo usa para todas las llamadas HTTP
- Al cerrar la app, Electron mata el proceso Python limpiamente

---

## 3. Estructura de Carpetas del Proyecto

```
bank-analyzer/
├── electron/                    # Main process de Electron
│   ├── main.ts                  # Entry point, crea BrowserWindow
│   ├── preload.ts               # contextBridge — expone API segura al renderer
│   ├── python-bridge.ts         # Lanza/mata el proceso Python, gestiona puerto
│   └── ipc-handlers.ts          # Handlers ipcMain (file dialogs, etc.)
│
├── src/                         # Renderer (React + TypeScript)
│   ├── App.tsx                  # Router principal
│   ├── main.tsx                 # Entry point del renderer
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # Navegación lateral con meses
│   │   │   └── TopBar.tsx       # Título, mes activo, acciones rápidas
│   │   ├── dashboard/
│   │   │   ├── SummaryCards.tsx # Tarjetas: ingresos, egresos, balance
│   │   │   ├── CategoryChart.tsx # Donut chart por categoría (Recharts)
│   │   │   └── MonthlyChart.tsx  # Bar chart histórico (Recharts)
│   │   ├── movements/
│   │   │   ├── MovementsTable.tsx # Tabla con filtros y búsqueda
│   │   │   └── MovementRow.tsx
│   │   ├── upload/
│   │   │   └── UploadZone.tsx   # Drag & drop PDF
│   │   └── settings/
│   │       └── CategoryEditor.tsx # Editor de keywords por categoría
│   ├── hooks/
│   │   ├── useMonths.ts
│   │   ├── useMovements.ts
│   │   └── useCategories.ts
│   ├── services/
│   │   └── api.ts               # Wrapper de fetch hacia el backend Python
│   └── styles/
│       └── globals.css          # Variables CSS, Tailwind base
│
├── python/                      # Backend FastAPI
│   ├── main.py                  # Entry point FastAPI, encuentra puerto libre
│   ├── api/
│   │   ├── routes/
│   │   │   ├── statements.py    # POST /upload, GET /months
│   │   │   ├── movements.py     # GET /movements, PUT /movements/{id}
│   │   │   ├── categories.py    # GET/PUT /categories
│   │   │   └── export.py        # GET /export/csv, GET /export/excel
│   │   └── deps.py              # Dependencias FastAPI (DB session)
│   ├── core/
│   │   ├── pdf_parser.py        # Lógica pdfplumber (migrado del .py original)
│   │   ├── categorizer.py       # Motor de categorización
│   │   └── exporter.py          # CSV y Excel con openpyxl
│   ├── models/
│   │   ├── database.py          # SQLAlchemy engine + Base
│   │   └── schemas.py           # Modelos ORM: Month, Movement, Category
│   └── requirements.txt
│
├── assets/
│   ├── icon.icns                # Ícono macOS
│   ├── icon.ico                 # Ícono Windows
│   └── icon.png
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml         # Configuración de empaquetado
└── README.md
```

---

## 4. Base de Datos — Esquema SQLite

```sql
-- Meses cargados
CREATE TABLE months (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL,           -- 1-12
    bank_name   TEXT,                       -- nombre del banco (extraído del PDF)
    file_name   TEXT NOT NULL,             -- nombre original del PDF
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month)                    -- un extracto por mes
);

-- Movimientos individuales
CREATE TABLE movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id    INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,             -- formato "DD/MM"
    description TEXT NOT NULL,
    amount      REAL NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('Ingreso', 'Egreso')),
    category_id INTEGER REFERENCES categories(id),
    note        TEXT                       -- nota manual del usuario
);

-- Categorías (editables por el usuario)
CREATE TABLE categories (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    keywords TEXT NOT NULL,               -- JSON array de strings
    color    TEXT NOT NULL DEFAULT '#6366f1',  -- color hex para UI
    icon     TEXT NOT NULL DEFAULT '📦'
);

-- Datos iniciales de categorías
INSERT INTO categories (name, keywords, color, icon) VALUES
    ('Salario',      '["salario","sueldo","pago","compensación"]', '#22c55e', '💼'),
    ('Transferencia','["transferencia","envío","giro"]',           '#3b82f6', '↔️'),
    ('Compras',      '["compra","tienda","comercio","retail"]',    '#f59e0b', '🛍️'),
    ('Servicios',    '["luz","agua","gas","internet","teléfono"]', '#8b5cf6', '⚡'),
    ('Comisiones',   '["comisión","comisiones","mantenimiento"]',  '#ef4444', '🏦'),
    ('Restaurantes', '["restaurante","café","comida","delivery"]', '#f97316', '🍽️'),
    ('Transporte',   '["taxi","uber","metro","gasolina","peaje"]', '#06b6d4', '🚗'),
    ('Otros',        '[]',                                         '#94a3b8', '📦');
```

---

## 5. API REST — Endpoints Python/FastAPI

### Base URL: `http://localhost:{PORT}/api/v1`

#### Statements (Extractos)
```
POST   /statements/upload
  Body: multipart/form-data { file: PDF }
  Returns: { month_id, year, month, movements_count, preview: Movement[] }

GET    /statements/months
  Returns: Month[] ordenados desc por año/mes
  Cada Month incluye: { id, year, month, bank_name, file_name, 
                        total_income, total_expenses, movements_count }

DELETE /statements/months/{month_id}
  Elimina mes y todos sus movimientos (CASCADE)
```

#### Movements (Movimientos)
```
GET    /movements?month_id={id}&category_id={id}&type={Ingreso|Egreso}&search={text}
  Returns: Movement[]

PUT    /movements/{id}
  Body: { category_id?, note? }
  Returns: Movement actualizado

GET    /movements/summary?month_id={id}
  Returns: { by_category: CategorySummary[], total_income, total_expenses, balance }
```

#### Categories (Categorías)
```
GET    /categories
  Returns: Category[]

POST   /categories
  Body: { name, keywords: string[], color, icon }

PUT    /categories/{id}
  Body: { name?, keywords?, color?, icon? }

DELETE /categories/{id}
  Solo si no tiene movimientos asociados
```

#### Export
```
GET    /export/csv?month_id={id}
  Returns: archivo CSV (text/csv)

GET    /export/excel?month_id={id}
  Returns: archivo .xlsx (application/vnd.openxmlformats...)
  Incluye hoja "Movimientos" + hoja "Resumen por Categoría"

GET    /export/report?month_id={id}
  Returns: reporte de texto plano (retrocompatible con lógica original)
```

---

## 6. Pantallas y Flujo de Usuario

### 6.1 Vista Principal — Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo] Bank Analyzer          [Mes activo: Febrero 2025]  [⚙️] │
├──────────────┬──────────────────────────────────────────────────┤
│              │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  HISTORIAL   │  │ Ingresos │ │ Egresos  │ │    Balance       │ │
│              │  │ $4,200k  │ │ $3,100k  │ │    +$1,100k      │ │
│  ▶ Feb 2025  │  └──────────┘ └──────────┘ └──────────────────┘ │
│    Ene 2025  │                                                   │
│    Dic 2024  │  [Gráfica Donut - Por Categoría]                │
│    Nov 2024  │                                                   │
│    Oct 2024  │  [Bar Chart - Últimos 6 meses]                  │
│              │                                                   │
│  [+ Cargar   │  [Tabla de movimientos con filtros]             │
│     nuevo]   │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

### 6.2 Carga de PDF
- Drag & drop o click para seleccionar archivo
- Indicador de progreso mientras parsea
- Preview de los movimientos detectados antes de confirmar
- Confirmación muestra: "Se detectaron N movimientos para Mes XXXX. ¿Confirmar carga?"
- Si ya existe ese mes: "Ya tienes datos para este mes. ¿Reemplazar?"

### 6.3 Tabla de Movimientos
- Columnas: Fecha | Descripción | Monto | Tipo | Categoría | Nota
- Filtros: por categoría (pills), por tipo (Ingreso/Egreso), búsqueda de texto
- Click en categoría de una fila → dropdown para reasignar manualmente
- Click en nota → edición inline
- Colores: filas de ingreso con tinte verde suave, egresos con tinte rojo suave

### 6.4 Configuración de Categorías
- Lista de categorías con su color e ícono
- Click para expandir y editar keywords (chips editables)
- Botón para agregar categoría nueva
- Botón para eliminar (solo si sin movimientos)
- Cambios se aplican en tiempo real (re-categoriza movimientos existentes)

---

## 7. Diseño Visual

### Dirección Estética
**Luxury Financial / Editorial Refinado**  
Inspirado en dashboards de banca privada y herramientas como Linear o Cron.

### Paleta de Colores
```css
:root {
  /* Base */
  --bg-primary:     #0d0f14;   /* Casi negro azulado */
  --bg-secondary:   #13161e;   /* Cards y paneles */
  --bg-tertiary:    #1a1e29;   /* Hover states, bordes */

  /* Texto */
  --text-primary:   #f0f2f7;
  --text-secondary: #8891a8;
  --text-muted:     #4a5168;

  /* Accents */
  --accent-primary: #4f7fff;   /* Azul royal — acción principal */
  --accent-green:   #22c55e;   /* Ingresos */
  --accent-red:     #ef4444;   /* Egresos */
  --accent-amber:   #f59e0b;   /* Warnings */

  /* Bordes */
  --border:         #1e2333;
  --border-subtle:  #252b3d;
}
```

### Tipografía
```
Display / Números grandes: "DM Serif Display" (Google Fonts)
  → Usado para montos en tarjetas summary, da sensación de peso financiero

UI / Cuerpo: "Geist" (Vercel) o "IBM Plex Sans"
  → Clean, técnico, excelente legibilidad en tablas

Mono / Códigos, fechas: "JetBrains Mono"
  → Para columnas de fecha y monto en la tabla
```

### Componentes Clave
- **Sidebar**: fondo `bg-secondary`, lista de meses como items con hover, mes activo con pill lateral de `accent-primary`
- **Summary Cards**: fondo `bg-secondary`, borde sutil, número grande en `DM Serif Display`, trend badge (+/- vs mes anterior)
- **Tabla**: alternancia de filas muy sutil, hover highlight, sin líneas horizontales pesadas
- **Charts**: usar Recharts con colores de la paleta, sin fondos blancos
- **Upload Zone**: borde punteado animado, ícono de PDF, transición suave al arrastrar

---

## 8. Empaquetado y Distribución

### Configuración electron-builder.yml
```yaml
appId: com.tuapp.bankanalyzer
productName: Bank Analyzer
directories:
  output: dist-electron

mac:
  category: public.app-category.finance
  target:
    - target: dmg
      arch: [x64, arm64]   # Intel + Apple Silicon
  icon: assets/icon.icns

win:
  target:
    - target: nsis          # Instalador clásico
    - target: portable      # .exe portable sin instalación
  icon: assets/icon.ico

# Incluir el ejecutable Python empaquetado con PyInstaller
extraResources:
  - from: python-dist/
    to: python/
    filter: ["**/*"]
```

### Proceso de build completo
```bash
# 1. Empaquetar el backend Python
cd python/
pip install pyinstaller
pyinstaller main.py --onefile --name bank-analyzer-backend --hidden-import=pdfplumber

# 2. Copiar ejecutable a carpeta de recursos
cp dist/bank-analyzer-backend ../python-dist/

# 3. Build Electron
cd ..
npm run build        # Vite compila el renderer
npm run electron:build  # electron-builder empaqueta todo
```

### Resultado
```
dist-electron/
├── Bank Analyzer-1.0.0.dmg          # macOS universal
├── Bank Analyzer-1.0.0-arm64.dmg    # macOS Apple Silicon
├── Bank Analyzer Setup 1.0.0.exe    # Windows instalador
└── Bank Analyzer 1.0.0.exe          # Windows portable
```

---

## 9. package.json — Dependencias Clave

```json
{
  "name": "bank-analyzer",
  "version": "1.0.0",
  "main": "electron/main.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"electron .\"",
    "build": "vite build && tsc -p electron/tsconfig.json",
    "electron:build": "electron-builder"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.22.0",
    "recharts": "^2.12.0",
    "electron-updater": "^6.1.0"
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^24.9.0",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "concurrently": "^8.2.0"
  }
}
```

### requirements.txt (Python)
```
fastapi==0.111.0
uvicorn==0.29.0
pdfplumber==0.11.0
pandas==2.2.2
openpyxl==3.1.2
sqlalchemy==2.0.29
pydantic==2.7.0
python-multipart==0.0.9
```

---

## 10. Flujo de Inicio de la App

```typescript
// electron/main.ts — secuencia de arranque
async function createApp() {
  // 1. Crear ventana principal (oculta inicialmente)
  const win = new BrowserWindow({ show: false, ... })

  // 2. Lanzar proceso Python
  const port = await launchPythonBackend()
  
  // 3. Esperar a que FastAPI esté listo (health check)
  await waitForBackend(`http://localhost:${port}/health`)
  
  // 4. Pasar el puerto al renderer via preload
  win.webContents.executeJavaScript(`window.API_PORT = ${port}`)
  
  // 5. Cargar la UI y mostrar ventana
  await win.loadURL(VITE_DEV_SERVER_URL || `file://${__dirname}/../dist/index.html`)
  win.show()
}

app.on('before-quit', () => {
  killPythonBackend()
})
```

---

## 11. Lógica de Parseo PDF — Notas para el Desarrollador

El parser actual usa regex básico. Se debe mejorar con estas estrategias:

### Estrategia multi-banco
```python
# python/core/pdf_parser.py

BANK_PATTERNS = {
    "bancolombia": {
        "date_pattern": r"(\d{2}/\d{2}/\d{4})",
        "amount_pattern": r"([\d,.]+)",
        "row_pattern": r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,.]+)\s+([\d,.]+)"
    },
    "davivienda": {
        # patrón específico Davivienda
    },
    "nequi": {
        # patrón específico Nequi
    },
    "generic": {
        # fallback con el regex original
        "row_pattern": r"(\d{2}/\d{2})\s+(.+?)\s+(-?\d+[.,]\d{2})"
    }
}

def detect_bank(text: str) -> str:
    """Detecta el banco por palabras clave en el PDF"""
    text_lower = text.lower()
    if "bancolombia" in text_lower:
        return "bancolombia"
    elif "davivienda" in text_lower:
        return "davivienda"
    return "generic"
```

### Extracción con tablas (recomendado)
```python
# Preferir extracción de tablas sobre regex en texto plano
with pdfplumber.open(file_path) as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        if tables:
            # Procesar tabla estructurada (más confiable)
            process_table(tables[0])
        else:
            # Fallback a regex sobre texto
            process_text(page.extract_text())
```

---

## 12. Checklist de Implementación

### Fase 1 — Setup y esqueleto (Día 1-2)
- [ ] Inicializar proyecto con `electron-vite` o setup manual Electron + Vite
- [ ] Configurar TypeScript en electron/ y src/
- [ ] Configurar Tailwind CSS
- [ ] Crear ventana principal con sidebar y topbar vacíos
- [ ] Setup FastAPI en python/ con endpoint `/health`
- [ ] Implementar python-bridge.ts (lanzar/matar proceso Python)
- [ ] Verificar comunicación Electron ↔ FastAPI

### Fase 2 — Backend Python (Día 3-4)
- [ ] Esquema SQLite y modelos SQLAlchemy
- [ ] Migrar pdf_parser.py del código original
- [ ] Endpoints /statements/upload y /statements/months
- [ ] Endpoints /movements con filtros
- [ ] Endpoints /categories CRUD
- [ ] Endpoints /export CSV y Excel

### Fase 3 — Frontend React (Día 5-7)
- [ ] Sidebar con lista de meses (useMonths hook)
- [ ] Dashboard con SummaryCards
- [ ] CategoryChart (Recharts Donut)
- [ ] MonthlyChart (Recharts Bar — historial 6 meses)
- [ ] MovementsTable con filtros
- [ ] UploadZone (drag & drop)
- [ ] CategoryEditor en Settings

### Fase 4 — Polish y empaquetado (Día 8-9)
- [ ] Aplicar diseño visual completo (tipografías, paleta, animaciones)
- [ ] Manejo de errores y estados de carga
- [ ] Empaquetar Python con PyInstaller
- [ ] Configurar electron-builder
- [ ] Test de build en Mac y Windows
- [ ] Crear README con instrucciones de instalación

---

## 13. Notas Finales para la IA Desarrolladora

1. **No uses `<form>` HTML nativo en React** — usa `onClick`/`onChange` handlers
2. **El puerto de Python es dinámico** — nunca hardcodear 8000. Leer siempre desde `window.API_PORT`
3. **SQLite file location** — usar siempre `app.getPath('userData')` de Electron para respetar convenciones del SO
4. **Seguridad Electron** — habilitar `contextIsolation: true` y `nodeIntegration: false`. Todo acceso a Node.js va por el preload bridge
5. **El ejecutable Python** en producción vive en `process.resourcesPath + '/python/'`. En desarrollo, usar el intérprete local con `python main.py`
6. **Recharts** es la librería de gráficas recomendada — ya está listada en dependencias y funciona bien con Tailwind dark mode
7. **Manejo de encoding** — los PDFs latinoamericanos pueden tener caracteres especiales. Usar `encoding='utf-8-sig'` en exports CSV
8. **El código Python original** en `bank_statement_analyzer.py` es la referencia de la lógica de negocio (parser, categorizer, exporter) — migrar esa lógica al nuevo backend, no reescribir desde cero
