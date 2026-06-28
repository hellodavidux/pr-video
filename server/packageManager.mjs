import { access, readFile } from 'fs/promises'
import { join } from 'path'
import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(execFileCb)

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function hasWorkspaceProtocol(pkg) {
  const blob = JSON.stringify({
    dependencies: pkg.dependencies,
    devDependencies: pkg.devDependencies,
    optionalDependencies: pkg.optionalDependencies,
  })
  return blob.includes('workspace:')
}

export async function detectPackageManager(workDir) {
  if (await exists(join(workDir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (await exists(join(workDir, 'pnpm-workspace.yaml'))) return 'pnpm'
  if (await exists(join(workDir, 'bun.lockb'))) return 'bun'
  if (await exists(join(workDir, 'yarn.lock'))) return 'yarn'

  try {
    const pkg = JSON.parse(await readFile(join(workDir, 'package.json'), 'utf8'))
    const pm = pkg.packageManager ?? ''
    if (pm.startsWith('pnpm@')) return 'pnpm'
    if (pm.startsWith('yarn@')) return 'yarn'
    if (pm.startsWith('bun@')) return 'bun'
    if (pkg.workspaces) return 'pnpm'
    if (hasWorkspaceProtocol(pkg)) return 'pnpm'
  } catch {
    // no root package.json
  }

  return 'npm'
}

export async function resolveInstallRoot(workDir, appRoot) {
  if (appRoot === workDir) return workDir

  if (await exists(join(workDir, 'pnpm-workspace.yaml'))) return workDir

  try {
    const rootPkg = JSON.parse(await readFile(join(workDir, 'package.json'), 'utf8'))
    if (rootPkg.workspaces) return workDir
    if (hasWorkspaceProtocol(rootPkg)) return workDir
  } catch {
    // single-package repo
  }

  return appRoot
}

async function run(cmd, args, options = {}) {
  await execFile(cmd, args, {
    ...options,
    shell: true,
    timeout: options.timeout ?? 300000,
  })
}

export async function ensurePackageManager(pm) {
  try {
    await run(pm, ['--version'], { timeout: 15000 })
    return
  } catch {
    // try corepack for pnpm/yarn
  }

  if (pm === 'pnpm' || pm === 'yarn') {
    try {
      await run('corepack', ['enable'], { timeout: 30000 })
      const prepare =
        pm === 'pnpm'
          ? ['corepack', 'prepare', 'pnpm@9', '--activate']
          : ['corepack', 'prepare', 'yarn@stable', '--activate']
      await run(prepare[0], prepare.slice(1), { timeout: 120000 })
      await run(pm, ['--version'], { timeout: 15000 })
      return
    } catch {
      // fall through
    }
  }

  if (pm === 'pnpm') {
    await run('npm', ['install', '-g', 'pnpm'], { timeout: 180000 })
    return
  }

  throw new Error(
    `${pm} is required for this repo (workspace/monorepo). Install ${pm} or use the optional hosted URL fallback.`
  )
}

export function installCommand(pm) {
  switch (pm) {
    case 'pnpm':
      return { command: 'pnpm', args: ['install'] }
    case 'yarn':
      return { command: 'yarn', args: ['install'] }
    case 'bun':
      return { command: 'bun', args: ['install'] }
    default:
      return { command: 'npm', args: ['install'] }
  }
}

function isNextScript(script = '') {
  return /\bnext\b/.test(script)
}

function commonServerEnv(port) {
  return {
    PORT: String(port),
    HOST: '127.0.0.1',
    HOSTNAME: '127.0.0.1',
    BROWSER: 'none',
    CI: 'true',
  }
}

export function buildCommand(pm, pkg) {
  if (!pkg.scripts?.build) {
    throw new Error('No build script in package.json')
  }

  switch (pm) {
    case 'pnpm':
      return { command: 'pnpm', args: ['run', 'build'] }
    case 'yarn':
      return { command: 'yarn', args: ['build'] }
    case 'bun':
      return { command: 'bun', args: ['run', 'build'] }
    default:
      return { command: 'npm', args: ['run', 'build'] }
  }
}

function previewCommand(pm, pkg, port) {
  const previewScript = pkg.scripts?.preview ?? ''
  const viteLike = /vite|astro/.test(previewScript)
  const nextLike = isNextScript(previewScript)

  let extraArgs = []
  if (viteLike) {
    extraArgs = ['--', '--host', '127.0.0.1', '--port', String(port)]
  } else if (nextLike) {
    extraArgs = ['--', '-p', String(port), '-H', '127.0.0.1']
  }

  const env = nextLike || !viteLike ? commonServerEnv(port) : {}

  switch (pm) {
    case 'pnpm':
      return { command: 'pnpm', args: ['run', 'preview', ...extraArgs], env }
    case 'yarn':
      return viteLike
        ? { command: 'yarn', args: ['preview', '--host', '127.0.0.1', '--port', String(port)], env }
        : { command: 'yarn', args: ['preview', ...extraArgs.slice(1)], env }
    case 'bun':
      return { command: 'bun', args: ['run', 'preview', ...extraArgs], env }
    default:
      return { command: 'npm', args: ['run', 'preview', ...extraArgs], env }
  }
}

function startCommand(pm, pkg, port) {
  const startScript = pkg.scripts?.start ?? ''
  const nextLike = isNextScript(startScript)
  const env = commonServerEnv(port)

  let extraArgs = []
  if (nextLike) {
    extraArgs = ['--', '-p', String(port), '-H', '127.0.0.1']
  }

  switch (pm) {
    case 'pnpm':
      return { command: 'pnpm', args: ['run', 'start', ...extraArgs], env }
    case 'yarn':
      return { command: 'yarn', args: ['start', ...extraArgs.slice(1)], env }
    case 'bun':
      return { command: 'bun', args: ['run', 'start', ...extraArgs], env }
    default:
      return { command: 'npm', args: ['run', 'start', ...extraArgs], env }
  }
}

function serveScriptCommand(pm, pkg, port) {
  const env = commonServerEnv(port)

  switch (pm) {
    case 'pnpm':
      return { command: 'pnpm', args: ['run', 'serve'], env }
    case 'yarn':
      return { command: 'yarn', args: ['serve'], env }
    case 'bun':
      return { command: 'bun', args: ['run', 'serve'], env }
    default:
      return { command: 'npm', args: ['run', 'serve'], env }
  }
}

function staticServeCommand(port, relativeDir) {
  return {
    command: 'npx',
    args: ['serve@14', '-l', `tcp://127.0.0.1:${port}`, '-n', relativeDir],
    env: commonServerEnv(port),
  }
}

export async function resolveServeCommand(pm, pkg, port, appRoot) {
  if (pkg.scripts?.preview) {
    return previewCommand(pm, pkg, port)
  }

  if (pkg.scripts?.start && pkg.scripts?.build) {
    return startCommand(pm, pkg, port)
  }

  if (pkg.scripts?.serve) {
    return serveScriptCommand(pm, pkg, port)
  }

  for (const dir of ['dist', 'build', 'out']) {
    if (await exists(join(appRoot, dir))) {
      return staticServeCommand(port, dir)
    }
  }

  if (await exists(join(appRoot, '.next')) && pkg.scripts?.start) {
    return startCommand(pm, pkg, port)
  }

  return null
}

export function devCommand(pm, pkg, port) {
  const devScript = pkg.scripts?.dev ?? ''
  const viteLike = /vite|astro|webpack/.test(devScript)
  const nextLike = isNextScript(devScript)
  const env = commonServerEnv(port)

  let portArgs = []
  if (viteLike) {
    portArgs = ['--', '--host', '127.0.0.1', '--port', String(port)]
  } else if (nextLike) {
    portArgs = ['--', '-p', String(port), '-H', '127.0.0.1']
  }

  switch (pm) {
    case 'pnpm':
      return {
        command: 'pnpm',
        args: pkg.scripts?.dev ? ['run', 'dev', ...portArgs] : ['run', 'start'],
        env,
      }
    case 'yarn':
      return {
        command: 'yarn',
        args: pkg.scripts?.dev
          ? viteLike
            ? ['dev', '--host', '127.0.0.1', '--port', String(port)]
            : nextLike
              ? ['dev', '-p', String(port), '-H', '127.0.0.1']
              : ['dev']
          : ['start'],
        env,
      }
    case 'bun':
      return {
        command: 'bun',
        args: pkg.scripts?.dev ? ['run', 'dev', ...portArgs] : ['run', 'start'],
        env,
      }
    default:
      return {
        command: 'npm',
        args: pkg.scripts?.dev ? ['run', 'dev', ...portArgs] : ['run', 'start'],
        env,
      }
  }
}
