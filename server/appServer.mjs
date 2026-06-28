const SERVER_START_TIMEOUT_MS = 180000
const LOG_TAIL_CHARS = 800

const URL_PATTERN = /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0):\d+(?:\/[^\s]*)?/gi

export function baseUrlsForPort(port) {
  return [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]
}

export function parseUrlsFromLogs(logs) {
  const text = logs.join('')
  const found = new Set()
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;]+$/, '').replace(/\/$/, '')
    found.add(url)
  }
  return [...found]
}

export function tailLogs(logs) {
  const text = logs.join('').trim()
  if (!text) return 'No server output captured.'
  return text.length > LOG_TAIL_CHARS ? text.slice(-LOG_TAIL_CHARS) : text
}

export function attachProcessLogs(process, logs) {
  const push = (chunk) => {
    const text = chunk.toString()
    logs.push(text)
    const line = text.trim()
    if (line) console.log('[app-server]', line)
  }

  process.stdout?.on('data', push)
  process.stderr?.on('data', push)

  process.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      logs.push(`\n[process exited with code ${code}]\n`)
    }
    if (signal) {
      logs.push(`\n[process killed with signal ${signal}]\n`)
    }
  })
}

export function isProcessAlive(process) {
  return process.exitCode === null && !process.killed
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      redirect: 'follow',
    })
    return res.status < 500
  } catch {
    return false
  }
}

export async function waitForAppServer(process, logs, port, timeoutMs = SERVER_START_TIMEOUT_MS) {
  const candidates = new Set(baseUrlsForPort(port))
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (!isProcessAlive(process)) {
      throw new Error(
        `App process exited before the server was ready. ${tailLogs(logs)}`
      )
    }

    for (const url of parseUrlsFromLogs(logs)) {
      candidates.add(url)
    }

    for (const url of candidates) {
      if (await probeUrl(url)) {
        return url
      }
    }

    await new Promise((r) => setTimeout(r, 2000))
  }

  throw new Error(
    `App server did not start within ${timeoutMs / 1000}s. Tried: ${[...candidates].join(', ')}. ${tailLogs(logs)}`
  )
}

export const SERVER_START_TIMEOUT = SERVER_START_TIMEOUT_MS
