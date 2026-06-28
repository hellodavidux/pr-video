import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[pr-video] ${name} exited with code ${code}`)
    }
  })
  return child
}

const api = run('api', 'node', ['server/index.mjs'])
const ui = run('ui', 'npm', ['run', 'dev:ui'])

function shutdown() {
  api.kill('SIGINT')
  ui.kill('SIGINT')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
