import { execFile as execFileCb, spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import getPort, { portNumbers } from 'get-port'
import { chromium } from 'playwright'
import { mkdir, rm } from 'fs/promises'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { CAPTURES_DIR } from './paths.mjs'
import { sessions } from './sessions.mjs'
import {
  attachProcessLogs,
  waitForAppServer,
} from './appServer.mjs'
import {
  buildCommand,
  detectPackageManager,
  devCommand,
  ensurePackageManager,
  installCommand,
  resolveInstallRoot,
  resolveServeCommand,
} from './packageManager.mjs'

const execFile = promisify(execFileCb)

const APP_ROOT_CANDIDATES = [
  '',
  'apps/web',
  'apps/client',
  'apps/app',
  'packages/web',
  'packages/app',
  'client',
  'frontend',
  'web',
]

async function run(cmd, args, options = {}) {
  await execFile(cmd, args, {
    ...options,
    shell: true,
    timeout: options.timeout ?? 300000,
  })
}

async function cloneRepo(workDir, owner, repo, headRef, prNumber) {
  const repoUrl = `https://github.com/${owner}/${repo}.git`

  try {
    await run('git', ['clone', '--depth', '1', '--branch', headRef, repoUrl, workDir])
    return
  } catch {
    await run('git', ['clone', '--depth', '1', repoUrl, workDir])
    await run('git', ['fetch', 'origin', `pull/${prNumber}/head:pr-video-branch`], { cwd: workDir })
    await run('git', ['checkout', 'pr-video-branch'], { cwd: workDir })
  }
}

async function findAppRoot(workDir) {
  for (const candidate of APP_ROOT_CANDIDATES) {
    const dir = join(workDir, candidate)
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
      if (
        pkg.scripts?.dev ||
        pkg.scripts?.start ||
        pkg.scripts?.build ||
        pkg.scripts?.preview
      ) {
        return { dir, pkg, relative: candidate }
      }
    } catch {
      // not an app root
    }
  }
  throw new Error('Could not find a package.json with dev, build, or start scripts')
}

async function captureScreenshot(url, outputPath) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: outputPath, type: 'png' })
  } finally {
    await browser.close()
  }
}

async function killProcess(process) {
  if (!process || process.killed) return
  process.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 500))
  if (!process.killed) process.kill('SIGKILL')
}

function spawnAppProcess(command, args, cwd, env) {
  return spawn(command, args, {
    cwd,
    shell: true,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function startBuiltApp(pm, pkg, appRoot, port) {
  const { command, args } = buildCommand(pm, pkg)
  await run(command, args, { cwd: appRoot, timeout: 600000 })

  const serve = await resolveServeCommand(pm, pkg, port, appRoot)
  if (!serve) {
    throw new Error('Build succeeded but no preview/start/serve script or static output folder found')
  }

  const appProcess = spawnAppProcess(serve.command, serve.args, appRoot, serve.env ?? {})
  return { appProcess, captureMode: 'production' }
}

async function startDevApp(pm, pkg, appRoot, port) {
  const { command, args, env: extraEnv } = devCommand(pm, pkg, port)
  const appProcess = spawnAppProcess(command, args, appRoot, extraEnv ?? {})
  return { appProcess, captureMode: 'development' }
}

async function startAndWait(startFn, pm, pkg, appRoot, port) {
  const logs = []
  const { appProcess, captureMode } = await startFn(pm, pkg, appRoot, port)
  attachProcessLogs(appProcess, logs)

  try {
    const appUrl = await waitForAppServer(appProcess, logs, port)
    return { appProcess, captureMode, appUrl }
  } catch (err) {
    await killProcess(appProcess)
    throw err
  }
}

async function allocatePort() {
  return getPort({ port: portNumbers(4321, 4999), reserve: true })
}

export async function hostAndCapture({
  owner,
  repoName,
  headRef,
  prNumber,
  mode = 'auto',
}) {
  const workDir = await mkdtemp(join(tmpdir(), 'pr-video-'))
  const jobId = `${owner}-${repoName}-pr${prNumber}-${Date.now()}`
  const captureDir = join(CAPTURES_DIR, jobId)
  await mkdir(captureDir, { recursive: true })

  let appProcess = null

  const cleanup = async () => {
    await killProcess(appProcess)
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }

  try {
    await cloneRepo(workDir, owner, repoName, headRef, prNumber)

    const pm = await detectPackageManager(workDir)
    await ensurePackageManager(pm)

    const { dir: appRoot, pkg } = await findAppRoot(workDir)
    const installRoot = await resolveInstallRoot(workDir, appRoot)
    const { command: installCmd, args: installArgs } = installCommand(pm)

    await run(installCmd, installArgs, { cwd: installRoot, timeout: 600000 })

    const tryBuild = mode === 'build' || mode === 'auto'
    const buildOnly = mode === 'build'

    let captureMode = 'development'
    let appUrl = null
    let productionError = null

    if (tryBuild && pkg.scripts?.build) {
      const port = await allocatePort()
      try {
        const result = await startAndWait(startBuiltApp, pm, pkg, appRoot, port)
        appProcess = result.appProcess
        captureMode = result.captureMode
        appUrl = result.appUrl
      } catch (err) {
        productionError = err
        console.warn('[host-and-capture] production path failed:', err.message)
        if (buildOnly) throw err
      }
    }

    if (!appUrl) {
      await killProcess(appProcess)
      appProcess = null

      const devPort = await allocatePort()
      try {
        const result = await startAndWait(startDevApp, pm, pkg, appRoot, devPort)
        appProcess = result.appProcess
        captureMode = result.captureMode
        appUrl = result.appUrl
      } catch (devErr) {
        const hint = productionError
          ? `Production: ${productionError.message}. Dev: ${devErr.message}`
          : devErr.message
        throw new Error(hint)
      }
    }

    const screenshotPath = join(captureDir, 'home.png')
    await captureScreenshot(appUrl, screenshotPath)

    sessions.set(jobId, { appUrl, devProcess: appProcess, workDir, cleanup })

    return {
      jobId,
      appUrl,
      captureMode,
      packageManager: pm,
      screenshots: [
        {
          url: `/captures/${jobId}/home.png`,
          filePath: screenshotPath,
          label: captureMode === 'production' ? 'Built app' : 'App home',
          source: `${owner}/${repoName}@${headRef}`,
        },
      ],
    }
  } catch (err) {
    await cleanup()
    throw err
  }
}
