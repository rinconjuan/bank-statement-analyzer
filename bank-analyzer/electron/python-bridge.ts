import { spawn, ChildProcess, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import treeKill from 'tree-kill'

const PORT_FILE = path.join(os.tmpdir(), 'bank_analyzer_port.json')
// Persists the PID of the running backend so orphaned processes from a
// previous session can be cleaned up on next start.
const PID_FILE = path.join(os.tmpdir(), 'bank_analyzer_pid.json')
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

/**
 * Synchronously kill a process tree.
 * On Windows we use `taskkill /F /T /PID` via execSync so the kill completes
 * before the calling code returns — critical for the quit-event handlers where
 * Electron does not await async callbacks.
 * On other platforms we use process.kill() which sends SIGKILL synchronously.
 * Any child processes the backend spawned will be cleaned up by the OS.
 */
function killProcessSync(pid: number): void {
  // Validate that pid is a safe positive integer before using it in a shell command.
  if (!Number.isInteger(pid) || pid <= 0) {
    console.warn(`killProcessSync: invalid PID "${pid}", skipping kill`)
    return
  }
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' })
    } catch (_) { /* process may have already exited */ }
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch (_) { /* process may have already exited */ }
  }
}

export class PythonBridge {
  private process: ChildProcess | null = null

  /**
   * Kill any orphaned backend process left over from a previous session.
   * Reads the PID written by the last start() call and forcefully terminates it.
   */
  private killOrphan(): void {
    try {
      const data = JSON.parse(fs.readFileSync(PID_FILE, 'utf-8'))
      if (typeof data.pid === 'number') {
        console.log(`[PythonBridge] Killing orphaned backend process PID ${data.pid}`)
        killProcessSync(data.pid)
      }
    } catch (_) { /* no PID file or invalid contents — nothing to do */ }
    try { fs.unlinkSync(PID_FILE) } catch (_) {}
  }

  /**
   * Start the Python backend.
   * @param userDataPath  Electron userData directory (app.getPath('userData')).
   *                      When provided the SQLite database is stored there so it
   *                      survives app updates and reinstalls.
   */
  async start(userDataPath?: string): Promise<number> {
    // Kill any orphaned backend from a previous session before starting a new one
    this.killOrphan()

    // Clean up old port file
    try { fs.unlinkSync(PORT_FILE) } catch (_) {}

    const pythonPath = isDev
      ? findPython()
      : path.join(process.resourcesPath, 'python', 'bank-analyzer-backend.exe')

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
      PORT_FILE,
      PYTHONUNBUFFERED: '1',
      ...(dbPath ? { DB_PATH: dbPath } : {}),
    }

    // windowsHide: true prevents a spurious console window on Windows and
    // ensures the child process is part of the same console group so that
    // taskkill /T can reach it.
    const spawnOptions = isDev
      ? { env, cwd: path.join(__dirname, '../python'), windowsHide: true }
      : { env, windowsHide: true }

    this.process = spawn(pythonPath, args, spawnOptions)

    // Write the PID immediately so the next session can clean up if we crash
    // before calling stop().
    if (this.process.pid) {
      try {
        fs.writeFileSync(PID_FILE, JSON.stringify({ pid: this.process.pid }), 'utf-8')
      } catch (_) {}
    }

    this.process.stdout?.on('data', (d) => console.log('[Python]', d.toString()))
    this.process.stderr?.on('data', (d) => console.error('[Python]', d.toString()))

    // Remove the PID file if the backend exits on its own so we don't try to
    // kill a recycled PID in a future session.
    this.process.on('exit', () => {
      try { fs.unlinkSync(PID_FILE) } catch (_) {}
    })

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
    // Capture and clear the reference first to prevent double-stop.
    const pid = this.process?.pid ?? null
    this.process = null

    if (pid) {
      // killProcessSync is synchronous on Windows (execSync + taskkill /F /T).
      // This is intentional: the quit-event handlers in main.ts do not (and
      // cannot) await an async callback, so we must block until the process
      // tree is actually dead before returning.
      killProcessSync(pid)
    }

    try { fs.unlinkSync(PORT_FILE) } catch (_) {}
    try { fs.unlinkSync(PID_FILE) } catch (_) {}
  }
}
