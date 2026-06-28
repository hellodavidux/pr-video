import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { sessions } from './sessions.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')
export const CAPTURES_DIR = join(ROOT, '.tmp', 'captures')
export const RENDERS_DIR = join(ROOT, '.tmp', 'renders')

export async function ensureCapturesDir() {
  await mkdir(CAPTURES_DIR, { recursive: true })
}

export async function stopSession(jobId) {
  const session = sessions.get(jobId)
  if (!session) return false
  await session.cleanup()
  sessions.delete(jobId)
  return true
}

export async function stopAllSessions() {
  for (const jobId of sessions.keys()) {
    await stopSession(jobId)
  }
}
