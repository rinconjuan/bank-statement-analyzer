import os
import sys
import socket
import tempfile
import json
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(__file__))

from models.database import init_db
from api.routes import statements, movements, categories, export, summary

# These are set in __main__ before uvicorn starts, and read inside the
# lifespan handler which runs after the socket is bound and listening.
_port: int = 0
_port_file: str = ''


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Write the port file here — server socket is already bound and
    # accepting connections, so Electron won't race ahead of us.
    if _port and _port_file:
        with open(_port_file, 'w') as f:
            json.dump({'port': _port}, f)
        print(f'Backend ready on port {_port}', flush=True)
    yield


app = FastAPI(title='Bank Analyzer API', version='1.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # 'null' is required for the Electron renderer in production, which loads from
    # file:// and sends Origin: null. allow_credentials MUST stay False — if ever
    # changed to True, sandboxed iframes and data: URIs (which also send Origin: null)
    # would gain cross-origin access to the backend.
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173', 'null'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(statements.router, prefix='/api/v1/statements', tags=['statements'])
app.include_router(movements.router, prefix='/api/v1/movements', tags=['movements'])
app.include_router(categories.router, prefix='/api/v1/categories', tags=['categories'])
app.include_router(export.router, prefix='/api/v1/export', tags=['export'])
app.include_router(summary.router, prefix='/api/v1/summary', tags=['summary'])


@app.get('/health')
def health():
    return {'status': 'ok'}


if __name__ == '__main__':
    _port = find_free_port()
    _port_file = os.environ.get('PORT_FILE', os.path.join(tempfile.gettempdir(), 'bank_analyzer_port.json'))

    print(f'Starting on port {_port}', flush=True)

    uvicorn.run(app, host='127.0.0.1', port=_port, log_level='error')
