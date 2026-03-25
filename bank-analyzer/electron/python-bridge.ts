import { spawn, ChildProcess, spawnSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import treeKill from 'tree-kill'

const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged

/** Returns the first Python interpreter found on PATH. */
function findPython(): string {
  for (const cmd of ['python3', 'python']) {
    try {
      const result = spawnSync(cmd, ['--version'], { stdio: 'ignore', timeout: 3000 })
      if (result.status === 0) return cmd
    } catch (_) {}
  }
  throw new Error('Python interpreter not found. Install Python 3 and ensure it is on your PATH.')
}

export class PythonBridge {
  private process: ChildProcess | null = null
  private portFilePath: string = path.join(os.tmpdir(), 'bank_analyzer_port.json') // fallback until start() is called

  /**
   * Start the Python backend.
   * @param userDataPath  Electron userData directory (app.getPath('userData')).
   *                      When provided the SQLite database is stored there so it
   *                      survives app updates and reinstalls.
   */
  async start(userDataPath?: string): Promise<number> {
    // Use userData dir for port file if available — avoids tmpdir collision on multi-instance launch
    this.portFilePath = userDataPath
      ? path.join(userDataPath, 'bank_analyzer_port.json')
      : path.join(os.tmpdir(), 'bank_analyzer_port.json')

    // Clean up old port file
    try { fs.unlinkSync(this.portFilePath) } catch (_) {}

    const pythonPath = isDev
      ? findPython()
      : path.join(
          process.resourcesPath,
          'python',
          process.platform === 'win32' ? 'bank-analyzer-backend.exe' : 'bank-analyzer-backend'
        )

    // In production, verify the bundled executable exists before trying to
    // spawn it.  A missing file would otherwise surface as an unhelpful
    // "ENOENT" crash in the main process.
    if (!isDev && !fs.existsSync(pythonPath)) {
      throw new Error(
        `Backend executable not found.\n\nExpected path:\n  ${pythonPath}\n\n` +
        `Please reinstall the application.`
      )
    }

    const scriptPath = isDev
      ? path.join(__dirname, '../python/main.py')
      : '' // No arguments needed, the .exe is standalone

    const args = isDev ? [scriptPath] : [] // Empty args for .exe in production

    // Resolve the database path: prefer the persistent userData directory so
    // the DB survives app updates / reinstalls.
    let dbPath: string | undefined
    if (userDataPath) {
      fs.mkdirSync(userDataPath, { recursive: true })
      dbPath = path.join(userDataPath, 'bank_analyzer.db')
    }

    const env = {
      ...process.env,
      PORT_FILE: this.portFilePath,
      PYTHONUNBUFFERED: '1',
      ...(dbPath ? { DB_PATH: dbPath } : {}),
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

      const cleanup = (err?: Error) => {
        clearInterval(interval)
        this.process?.removeListener('exit', onExit)
        this.process?.removeListener('error', onError)
        if (err) reject(err)
      }

      const onExit = (code: number | null) => {
        cleanup(new Error(`Python backend exited unexpectedly (code ${code})`))
      }
      const onError = (err: Error) => {
        cleanup(new Error(`Python backend failed to start: ${err.message}`))
      }

      this.process?.once('exit', onExit)
      this.process?.once('error', onError)

      const interval = setInterval(() => {
        if (Date.now() - start > maxWait) {
          cleanup(new Error('Python backend did not start in time'))
          return
        }
        try {
          if (fs.existsSync(this.portFilePath)) {
            const data = JSON.parse(fs.readFileSync(this.portFilePath, 'utf-8'))
            if (data.port && typeof data.port === 'number' && data.port > 1023 && data.port < 65536) {
              cleanup()
              resolve(data.port)
            }
          }
        } catch (_) {}
      }, 200)
    })
  }

  stop(): void {
    if (this.process && this.process.pid) {
      // Kill the entire process tree (cross-platform) so no orphaned backend
      // processes remain after the app closes.
      treeKill(this.process.pid, 'SIGTERM', (err) => {
        if (err) console.error('[PythonBridge] Failed to kill process tree:', err)
      })
      this.process = null
    }
    try { fs.unlinkSync(this.portFilePath) } catch (_) {}
  }
}
