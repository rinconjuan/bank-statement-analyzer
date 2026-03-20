import { spawn, ChildProcess, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const PORT_FILE = path.join(os.tmpdir(), 'bank_analyzer_port.json')
const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged

/** Returns the first Python interpreter found on PATH. */
function findPython(): string {
  for (const cmd of ['python3', 'python']) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' })
      return cmd
    } catch (_) {}
  }
  throw new Error('Python interpreter not found. Install Python 3 and ensure it is on your PATH.')
}

export class PythonBridge {
  private process: ChildProcess | null = null

  async start(): Promise<number> {
    // Clean up old port file
    try { fs.unlinkSync(PORT_FILE) } catch (_) {}

    const pythonPath = isDev
      ? findPython()
      : path.join(process.resourcesPath, 'python', 'main')

    const scriptPath = isDev
      ? path.join(__dirname, '../python/main.py')
      : ''

    const args = isDev ? [scriptPath] : []
    const env = {
      ...process.env,
      PORT_FILE,
      PYTHONUNBUFFERED: '1',
    }

    this.process = isDev
      ? spawn(pythonPath, args, { env, cwd: path.join(__dirname, '../python') })
      : spawn(pythonPath, args, { env })

    this.process.stdout?.on('data', (d) => console.log('[Python]', d.toString()))
    this.process.stderr?.on('data', (d) => console.error('[Python]', d.toString()))

    return this.waitForPort()
  }

  private waitForPort(maxWait = 15000): Promise<number> {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const interval = setInterval(() => {
        if (Date.now() - start > maxWait) {
          clearInterval(interval)
          reject(new Error('Python backend did not start in time'))
          return
        }
        try {
          if (fs.existsSync(PORT_FILE)) {
            const data = JSON.parse(fs.readFileSync(PORT_FILE, 'utf-8'))
            if (data.port) {
              clearInterval(interval)
              resolve(data.port)
            }
          }
        } catch (_) {}
      }, 200)
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    try { fs.unlinkSync(PORT_FILE) } catch (_) {}
  }
}
