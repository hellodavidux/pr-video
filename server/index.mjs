import express from 'express'
import cors from 'cors'
import { mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import { renderVideo } from './renderVideo.mjs'
import { RENDERS_DIR, CAPTURES_DIR, ensureCapturesDir, stopSession } from './paths.mjs'
import { screenshotUrl } from './screenshotUrl.mjs'
import { hostAndCapture } from './hostAndCapture.mjs'
import {
  buildLocalSourceBundle,
  calSimpleExists,
  rebuildPrLiveRegistry,
  serializeBundle,
  writePrComponents,
} from './localRepo.mjs'

const PORT = Number(process.env.PR_VIDEO_API_PORT) || 4174

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.use('/renders', express.static(RENDERS_DIR))
app.use('/captures', express.static(CAPTURES_DIR))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/local-repo/status', (_req, res) => {
  res.json({ available: calSimpleExists(), name: 'cal-simple' })
})

app.get('/api/local-repo/bundle', (_req, res) => {
  if (!calSimpleExists()) {
    res.status(404).json({ message: 'cal-simple folder not found in project root' })
    return
  }

  try {
    const bundle = buildLocalSourceBundle()
    res.json(serializeBundle(bundle))
  } catch (err) {
    console.error('[local-repo/bundle]', err)
    res.status(500).json({ message: err.message || 'Failed to read local repo' })
  }
})

app.post('/api/pr-components', (req, res) => {
  const { slideId, files } = req.body ?? {}
  if (!slideId || !files || typeof files !== 'object') {
    res.status(400).json({ message: 'slideId and files are required' })
    return
  }

  try {
    writePrComponents(slideId, files)
    res.json({ ok: true, slideId })
  } catch (err) {
    console.error('[pr-components]', err)
    res.status(500).json({ message: err.message || 'Failed to write PR components' })
  }
})

app.post('/api/pr-live-registry', (_req, res) => {
  try {
    const result = rebuildPrLiveRegistry()
    res.json(result)
  } catch (err) {
    console.error('[pr-live-registry]', err)
    res.status(500).json({ message: err.message || 'Failed to rebuild registry' })
  }
})

app.post('/api/screenshot-url', async (req, res) => {
  const { url } = req.body ?? {}
  if (!url?.trim()) {
    res.status(400).json({ message: 'url is required' })
    return
  }

  try {
    const jobId = randomUUID()
    const result = await screenshotUrl(url, jobId)
    res.json(result)
  } catch (err) {
    console.error('[screenshot-url]', err)
    res.status(500).json({ message: err.message || 'Screenshot failed' })
  }
})

app.post('/api/host-and-capture', async (req, res) => {
  const { owner, repoName, headRef, prNumber, mode } = req.body ?? {}

  if (!owner || !repoName || !headRef || !prNumber) {
    res.status(400).json({ message: 'owner, repoName, headRef, and prNumber are required' })
    return
  }

  try {
    const result = await hostAndCapture({ owner, repoName, headRef, prNumber, mode })
    res.json(result)
  } catch (err) {
    console.error('[host-and-capture]', err)
    res.status(500).json({ message: err.message || 'Build and capture failed' })
  }
})

app.post('/api/stop/:jobId', async (req, res) => {
  const stopped = await stopSession(req.params.jobId)
  res.json({ ok: true, stopped })
})

app.post('/api/render', async (req, res) => {
  const { script } = req.body ?? {}

  if (!script?.slides?.length) {
    res.status(400).json({ message: 'script with slides is required' })
    return
  }

  try {
    const result = await renderVideo(script, PORT)
    res.json(result)
  } catch (err) {
    console.error('[render]', err)
    res.status(500).json({ message: err.message || 'Remotion render failed' })
  }
})

await mkdir(RENDERS_DIR, { recursive: true })
await ensureCapturesDir()

const server = app.listen(PORT, () => {
  console.log(`[pr-video] Render API http://127.0.0.1:${PORT}`)
})

server.requestTimeout = 600000
server.headersTimeout = 600000
