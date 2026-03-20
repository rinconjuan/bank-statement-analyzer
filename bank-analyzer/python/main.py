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
from api.routes import statements, movements, categories, export


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title='Bank Analyzer API', version='1.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(statements.router, prefix='/api/v1/statements', tags=['statements'])
app.include_router(movements.router, prefix='/api/v1/movements', tags=['movements'])
app.include_router(categories.router, prefix='/api/v1/categories', tags=['categories'])
app.include_router(export.router, prefix='/api/v1/export', tags=['export'])


@app.get('/health')
def health():
    return {'status': 'ok'}


if __name__ == '__main__':
    port = find_free_port()

    port_file = os.environ.get('PORT_FILE', os.path.join(tempfile.gettempdir(), 'bank_analyzer_port.json'))
    with open(port_file, 'w') as f:
        json.dump({'port': port}, f)

    print(f'Starting on port {port}', flush=True)

    uvicorn.run(app, host='127.0.0.1', port=port, log_level='error')
